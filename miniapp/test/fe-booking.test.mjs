import test from 'node:test';
import assert from 'node:assert/strict';

test('FE Booking: Vietnamese phone number validation regex', () => {
  const isValidPhone = (phone) => /^[0-9+ ]{8,15}$/.test(phone.trim());

  assert.equal(isValidPhone('0912345678'), true, 'Standard 10-digit mobile is valid');
  assert.equal(isValidPhone('+84912345678'), true, 'International format is valid');
  assert.equal(isValidPhone('02613714499'), true, 'Landline with area code is valid');
  assert.equal(isValidPhone('123'), false, 'Too short number is rejected');
  assert.equal(isValidPhone('abcdefghijk'), false, 'Letters in phone are rejected');
});

test('FE Booking: Customer name validation', () => {
  const isValidName = (name) => {
    const trimmed = name.trim();
    return trimmed.length >= 2 && trimmed.length <= 100;
  };

  assert.equal(isValidName('Nguyễn Văn An'), true);
  assert.equal(isValidName('A'), false, 'Single character name rejected');
  assert.equal(isValidName('   '), false, 'Whitespace-only name rejected');
});

test('FE Booking: Mock payment state machine transitions', () => {
  const stateTransitions = (currentPaymentStatus, action) => {
    if (currentPaymentStatus === 'paid' && action === 'pay') {
      throw new Error('Đơn hàng đã thanh toán');
    }
    if (action === 'simulate_success') return { paymentStatus: 'paid', bookingStatus: 'confirmed' };
    if (action === 'simulate_failure') return { paymentStatus: 'failed', bookingStatus: 'pending' };
    if (action === 'refund' && currentPaymentStatus === 'paid') return { paymentStatus: 'refunded', bookingStatus: 'cancelled' };
    return { paymentStatus: currentPaymentStatus, bookingStatus: 'pending' };
  };

  // 1. Unpaid -> Simulate Success
  const res1 = stateTransitions('unpaid', 'simulate_success');
  assert.equal(res1.paymentStatus, 'paid');
  assert.equal(res1.bookingStatus, 'confirmed');

  // 2. Unpaid -> Simulate Failure
  const res2 = stateTransitions('unpaid', 'simulate_failure');
  assert.equal(res2.paymentStatus, 'failed');
  assert.equal(res2.bookingStatus, 'pending');

  // 3. Paid -> Refund
  const res3 = stateTransitions('paid', 'refund');
  assert.equal(res3.paymentStatus, 'refunded');
  assert.equal(res3.bookingStatus, 'cancelled');

  // 4. Paid -> Pay again throws
  assert.throws(() => stateTransitions('paid', 'pay'), /Đơn hàng đã thanh toán/);
});
