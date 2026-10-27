import { Router } from 'express';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';

import { Course, Enrollment, Payment } from '../models.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();

function getRazorpay() {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;

  console.log('Razorpay Key ID loaded:', Boolean(process.env.RAZORPAY_KEY_ID));
  console.log(
    'Razorpay Secret loaded:',
    Boolean(process.env.RAZORPAY_KEY_SECRET)
  );

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return null;
  }

  return new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
}

// Create a Razorpay order for a paid course.
router.post(
  '/create-order',
  requireAuth,
  allowRoles('student'),
  async (req, res) => {
    try {
      const { courseId } = req.body;

      if (!courseId || !/^[a-f\d]{24}$/i.test(courseId)) {
        return res.status(400).json({
          message: 'A valid courseId is required',
        });
      }

      const course = await Course.findOne({
        _id: courseId,
        published: true,
      });

      if (!course) {
        return res.status(404).json({
          message: 'Course not found',
        });
      }

      if (course.price <= 0) {
        return res.status(400).json({
          message: 'This is a free course. Use the free enrollment endpoint.',
        });
      }

      const existingEnrollment = await Enrollment.findOne({
        student: req.user.id,
        course: course._id,
      });

      if (existingEnrollment) {
        return res.status(409).json({
          message: 'Already enrolled',
        });
      }

      const razorpay = getRazorpay();

      if (!razorpay) {
        return res.status(503).json({
          message: 'Payment gateway is not configured yet',
        });
      }

      // Course prices are stored in rupees; Razorpay expects paise.
      const amountInPaise = Math.round(Number(course.price) * 100);

      if (!Number.isSafeInteger(amountInPaise) || amountInPaise <= 0) {
        return res.status(400).json({
          message: 'Invalid course price',
        });
      }

      // Razorpay receipt must not exceed 56 characters.
      // This generates a unique receipt with only 27 characters.
      const receipt = `ll_${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`;

      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: {
          courseId: String(course._id),
          studentId: String(req.user.id),
        },
      });

      let payment;

      try {
        payment = await Payment.create({
          student: req.user.id,
          course: course._id,
          instructor: course.instructor,
          amount: amountInPaise / 100,
          currency: 'INR',
          status: 'created',
          gateway: 'razorpay',
          gatewayOrderId: order.id,
        });
      } catch (error) {
        console.error(
          'Could not save payment record:',
          error.message
        );

        return res.status(500).json({
          message: 'Could not initialize the payment. Please try again.',
        });
      }

      return res.status(201).json({
        paymentId: payment._id,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      });
    } catch (error) {
      console.error(
        'Create Razorpay order failed:',
        error.error?.description || error.message
      );

      return res.status(500).json({
        message: 'Unable to create payment order. Please try again.',
      });
    }
  }
);

// Verify payment with the signature and Razorpay's server-side records.
router.post(
  '/verify',
  requireAuth,
  allowRoles('student'),
  async (req, res) => {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body;

    if (
      typeof orderId !== 'string' ||
      typeof paymentId !== 'string' ||
      typeof signature !== 'string'
    ) {
      return res.status(400).json({
        message: 'Order ID, payment ID, and signature are required',
      });
    }

    const payment = await Payment.findOne({
      student: req.user.id,
      gatewayOrderId: orderId,
    });

    if (!payment) {
      return res.status(404).json({
        message: 'Payment order not found',
      });
    }

    // Make retries safe after a successful verification.
    if (payment.status === 'paid') {
      const enrollment = await Enrollment.findOne({
        student: req.user.id,
        course: payment.course,
      });

      if (enrollment) {
        return res.json({
          message: 'Payment already verified',
          enrolled: true,
        });
      }
    }

    const razorpay = getRazorpay();

    if (!razorpay) {
      return res.status(503).json({
        message: 'Payment gateway is not configured yet',
      });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest();

    const suppliedSignature = Buffer.from(signature, 'hex');

    if (
      suppliedSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(suppliedSignature, expectedSignature)
    ) {
      return res.status(400).json({
        message: 'Invalid payment signature',
      });
    }

    // Never rely on the browser response alone.
    const [order, gatewayPayment] = await Promise.all([
      razorpay.orders.fetch(orderId),
      razorpay.payments.fetch(paymentId),
    ]);

    if (
      gatewayPayment.order_id !== orderId ||
      gatewayPayment.status !== 'captured' ||
      order.status !== 'paid' ||
      gatewayPayment.amount !== order.amount ||
      gatewayPayment.currency !== order.currency ||
      order.amount !== Math.round(payment.amount * 100) ||
      order.currency !== payment.currency
    ) {
      return res.status(400).json({
        message: 'Payment has not been successfully captured',
      });
    }

    if (
      payment.gatewayPaymentId &&
      payment.gatewayPaymentId !== paymentId
    ) {
      return res.status(409).json({
        message: 'A different payment is already associated with this order',
      });
    }

    // Re-check that the course still exists and the payment matches it.
    const course = await Course.findOne({
      _id: payment.course,
      published: true,
    });

    if (
      !course ||
      String(course.instructor) !== String(payment.instructor) ||
      Math.round(course.price * 100) !== order.amount
    ) {
      return res.status(409).json({
        message: 'Course details changed. Contact support before retrying.',
      });
    }

    // Persist verified payment details.
    payment.status = 'paid';
    payment.gatewayPaymentId = paymentId;
    payment.gatewaySignature = signature;
    payment.paidAt = new Date();

    await payment.save();

    // Unique student/course index prevents duplicate enrollments.
    const enrollment = await Enrollment.findOneAndUpdate(
      {
        student: req.user.id,
        course: payment.course,
      },
      {
        $setOnInsert: {
          student: req.user.id,
          course: payment.course,
          enrolledAt: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
      }
    );

    return res.json({
      message: 'Payment verified and enrollment confirmed',
      enrolled: true,
      enrollmentId: enrollment._id,
    });
  }
);

// Retrieve the logged-in student's payment history.
router.get(
  '/my-payments',
  requireAuth,
  allowRoles('student'),
  async (req, res) => {
    const payments = await Payment.find({
      student: req.user.id,
    })
      .select('-gatewaySignature')
      .populate('course', 'title')
      .populate('instructor', 'name')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ payments });
  }
);

export default router;