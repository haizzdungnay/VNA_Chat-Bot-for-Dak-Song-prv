import { request, queryD1, userAHeaders, userBHeaders, USER_A_ID, USER_B_ID, BASE_URL } from "./independent_audit.mjs";

const results = [];

function recordResult(vector, name, passed, details) {
  results.push({ vector, name, passed, details });
  const icon = passed ? "[PASS]" : "[FAIL]";
  console.log(`${icon} [${vector}] ${name}: ${details}`);
}

async function runVector1_Concurrency() {
  console.log("\n==================================================");
  console.log("VECTOR 1: Concurrency & Race Conditions");
  console.log("==================================================");

  // 1.1: 15 concurrent booking requests with the same quoteReference
  try {
    const quoteRes = await request("/api/quotes", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        tourId: "tour-ds-01",
        adultsCount: 2,
        childrenCount: 0,
      }),
    });

    if (quoteRes.status !== 201 || !quoteRes.data?.quote?.quote_reference) {
      recordResult("V1.1", "Quote Creation for Race Test", false, `HTTP ${quoteRes.status}: ${JSON.stringify(quoteRes.data)}`);
      return;
    }

    const quoteRef = quoteRes.data.quote.quote_reference;
    const quoteId = quoteRes.data.quote.id;

    // Fire 15 concurrent requests to create booking
    const promises = [];
    for (let i = 0; i < 15; i++) {
      promises.push(
        request("/api/bookings", {
          method: "POST",
          headers: userAHeaders,
          body: JSON.stringify({
            quoteReference: quoteRef,
            customerName: `Concurrent Tester ${i}`,
            customerPhone: "0987654321",
            notes: `Race request #${i}`,
          }),
        })
      );
    }

    const responses = await Promise.all(promises);
    const successCount = responses.filter((r) => r.status === 201).length;
    const conflictCount = responses.filter((r) => r.status === 409).length;

    // Verify DB
    const dbBookings = queryD1(`SELECT id, booking_reference, quote_id FROM tour_bookings WHERE quote_id = '${quoteId}'`);
    const dbQuote = queryD1(`SELECT id, status FROM booking_quotes WHERE id = '${quoteId}'`);

    const passed1_1 = successCount === 1 && conflictCount === 14 && dbBookings.length === 1 && dbQuote[0]?.status === "consumed";
    recordResult(
      "V1.1",
      "Concurrent Booking on Same Quote (15 requests)",
      passed1_1,
      `Success: ${successCount}/15, 409 Conflict: ${conflictCount}/15, DB Bookings: ${dbBookings.length}, Quote Status: ${dbQuote[0]?.status}`
    );
  } catch (err) {
    recordResult("V1.1", "Concurrent Booking on Same Quote", false, err.message);
  }

  // 1.2: Payment Concurrency Race (5 concurrent payment success requests)
  try {
    // Create fresh quote and booking
    const q = await request("/api/quotes", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({ tourId: "tour-ds-02", adultsCount: 1 }),
    });
    const b = await request("/api/bookings", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        quoteReference: q.data.quote.quote_reference,
        customerName: "Payment Race Tester",
        customerPhone: "0912345678",
      }),
    });

    const bookingId = b.data.booking.id;

    // Send 5 concurrent pay requests with different idempotency keys
    const payPromises = [];
    for (let i = 0; i < 5; i++) {
      payPromises.push(
        request(`/api/bookings/${bookingId}/pay`, {
          method: "POST",
          headers: userAHeaders,
          body: JSON.stringify({
            simulateStatus: "success",
            idempotencyKey: `pay-race-key-${i}-${Date.now()}`,
          }),
        })
      );
    }

    const payResponses = await Promise.all(payPromises);
    const paySuccess = payResponses.filter((r) => r.status === 200).length;
    const payConflict = payResponses.filter((r) => r.status === 409).length;

    const dbPayments = queryD1(
      `SELECT count(*) as count FROM mock_payment_attempts WHERE booking_id = '${bookingId}' AND status = 'success'`
    );
    const dbBooking = queryD1(`SELECT payment_status, booking_status FROM tour_bookings WHERE id = '${bookingId}'`);

    const passed1_2 = paySuccess === 1 && payConflict === 4 && dbPayments[0]?.count === 1 && dbBooking[0]?.payment_status === "paid";
    recordResult(
      "V1.2",
      "Concurrent Payment Requests (5 requests)",
      passed1_2,
      `Success: ${paySuccess}/5, Conflict: ${payConflict}/5, DB Success Attempts: ${dbPayments[0]?.count}, DB Status: ${dbBooking[0]?.payment_status}`
    );
  } catch (err) {
    recordResult("V1.2", "Concurrent Payment Requests", false, err.message);
  }

  // 1.3: Race between Pay & Cancel
  try {
    const q = await request("/api/quotes", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({ tourId: "tour-ds-03", adultsCount: 1 }),
    });
    const b = await request("/api/bookings", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        quoteReference: q.data.quote.quote_reference,
        customerName: "Pay Cancel Race Tester",
        customerPhone: "0912345678",
      }),
    });

    const bookingId = b.data.booking.id;

    // Fire 4 pay requests and 4 cancel requests concurrently
    const mixedPromises = [];
    for (let i = 0; i < 4; i++) {
      mixedPromises.push(
        request(`/api/bookings/${bookingId}/pay`, {
          method: "POST",
          headers: userAHeaders,
          body: JSON.stringify({ simulateStatus: "success" }),
        })
      );
      mixedPromises.push(
        request(`/api/bookings/${bookingId}/cancel`, {
          method: "POST",
          headers: userAHeaders,
          body: JSON.stringify({ reason: "Concurrent cancel test" }),
        })
      );
    }

    await Promise.all(mixedPromises);

    const dbBooking = queryD1(`SELECT payment_status, booking_status FROM tour_bookings WHERE id = '${bookingId}'`);
    const status = dbBooking[0];

    // Invalid hybrid state: (cancelled AND paid)
    const isInvalidHybrid = status?.booking_status === "cancelled" && status?.payment_status === "paid";
    const isValidFinalState =
      (status?.booking_status === "confirmed" && status?.payment_status === "paid") ||
      (status?.booking_status === "cancelled" && status?.payment_status === "unpaid");

    const passed1_3 = !isInvalidHybrid && isValidFinalState;
    recordResult(
      "V1.3",
      "Race between Pay and Cancel (8 requests)",
      passed1_3,
      `Final DB Status: booking_status=${status?.booking_status}, payment_status=${status?.payment_status} (isInvalidHybrid=${isInvalidHybrid})`
    );
  } catch (err) {
    recordResult("V1.3", "Race between Pay and Cancel", false, err.message);
  }

  // 1.4: Race between Admin Refund and Customer Re-pay
  try {
    const q = await request("/api/quotes", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({ tourId: "tour-ds-03", adultsCount: 1 }),
    });
    const b = await request("/api/bookings", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        quoteReference: q.data.quote.quote_reference,
        customerName: "Refund Race Tester",
        customerPhone: "0912345678",
      }),
    });
    const bookingId = b.data.booking.id;

    // Pay successfully first
    const payRes = await request(`/api/bookings/${bookingId}/pay`, {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({ simulateStatus: "success" }),
    });

    if (payRes.status !== 200) {
      recordResult("V1.4", "Initial Payment Setup", false, `Pay failed HTTP ${payRes.status}`);
      return;
    }

    // Now fire concurrently: 3 Admin mock-refund vs 3 Customer re-pay
    const raceRefundPay = [];
    for (let i = 0; i < 3; i++) {
      raceRefundPay.push(
        request(`/api/admin/bookings/${bookingId}/mock-refund`, {
          method: "POST",
          body: JSON.stringify({ reason: `Admin refund race ${i}` }),
        })
      );
      raceRefundPay.push(
        request(`/api/bookings/${bookingId}/pay`, {
          method: "POST",
          headers: userAHeaders,
          body: JSON.stringify({ simulateStatus: "success" }),
        })
      );
    }

    const raceResponses = await Promise.all(raceRefundPay);

    const dbRefunds = queryD1(`SELECT count(*) as count FROM mock_payment_refunds WHERE booking_id = '${bookingId}'`);
    const dbPayments = queryD1(
      `SELECT count(*) as count FROM mock_payment_attempts WHERE booking_id = '${bookingId}' AND status = 'success'`
    );
    const dbFinalBooking = queryD1(`SELECT payment_status, booking_status FROM tour_bookings WHERE id = '${bookingId}'`);

    const passed1_4 = dbRefunds[0]?.count === 1 && dbPayments[0]?.count === 1 && dbFinalBooking[0]?.payment_status === "refunded";
    recordResult(
      "V1.4",
      "Race between Admin Refund & Customer Re-Pay",
      passed1_4,
      `Refunds in DB: ${dbRefunds[0]?.count}, Payments in DB: ${dbPayments[0]?.count}, Status: ${dbFinalBooking[0]?.payment_status}`
    );
  } catch (err) {
    recordResult("V1.4", "Race between Admin Refund & Customer Re-Pay", false, err.message);
  }
}

async function runVector2_Fuzzing() {
  console.log("\n==================================================");
  console.log("VECTOR 2: Input Fuzzing & Boundary Testing");
  console.log("==================================================");

  // 2.1: Adults & Children & Duration fuzzing
  const fuzzCases = [
    { name: "adultsCount = 0", payload: { adultsCount: 0 }, expectFail: true },
    { name: "adultsCount = 1e15 (overflow)", payload: { adultsCount: 1e15 }, expectFail: true },
    { name: "adultsCount = '1' (string number)", payload: { adultsCount: "1" }, expectFail: false },
    { name: "adultsCount = -5", payload: { adultsCount: -5 }, expectFail: true },
    { name: "adultsCount = 1.5 (fractional)", payload: { adultsCount: 1.5 }, expectFail: true },
    { name: "childrenCount = -1", payload: { adultsCount: 2, childrenCount: -1 }, expectFail: true },
    { name: "childrenCount = 1.5 (fractional)", payload: { adultsCount: 2, childrenCount: 1.5 }, expectFail: true },
    { name: "childrenCount = -0", payload: { adultsCount: 2, childrenCount: -0 }, expectFail: false },
    { name: "durationDays = 0", payload: { adultsCount: 2, durationDays: 0 }, expectFail: true },
    { name: "durationDays = -3", payload: { adultsCount: 2, durationDays: -3 }, expectFail: true },
    { name: "durationDays = 2.5 (fractional)", payload: { adultsCount: 2, durationDays: 2.5 }, expectFail: true },
    { name: "totalTravelers > 50 (51 travelers)", payload: { adultsCount: 40, childrenCount: 11 }, expectFail: true },
  ];

  for (const c of fuzzCases) {
    const res = await request("/api/quotes", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({ tourId: "tour-ds-02", ...c.payload }),
    });

    const isFail = res.status >= 400;
    const passed = c.expectFail ? isFail : !isFail;
    recordResult(
      "V2.1",
      `Fuzz Quote: ${c.name}`,
      passed,
      `HTTP ${res.status}: ${res.data?.error || `total_price=${res.data?.quote?.total_price}`}`
    );
  }

  // 2.2: Per-night calculation edge cases
  // Tour with accommodation (per_night)
  // durationDays = 1 -> nights = 0 -> line_total = 0
  // durationDays = 2 -> nights = 1 -> line_total = unitPrice * 1
  try {
    const q1 = await request("/api/quotes", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        selectedServiceIds: ["srv-hotel-01"], // srv-hotel-01 is per_night
        adultsCount: 2,
        durationDays: 1,
      }),
    });

    const hotelItem1 = q1.data?.items?.find((i) => i.service_id === "srv-hotel-01");
    const passed2_2a = hotelItem1?.quantity === 0 && hotelItem1?.line_total === 0;
    recordResult(
      "V2.2",
      "Per-night Calculation for 1-Day Itinerary (0 nights)",
      passed2_2a,
      `Quantity: ${hotelItem1?.quantity}, Line total: ${hotelItem1?.line_total}`
    );

    const q2 = await request("/api/quotes", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        selectedServiceIds: ["srv-hotel-01"],
        adultsCount: 2,
        durationDays: 3,
      }),
    });
    const hotelItem2 = q2.data?.items?.find((i) => i.service_id === "srv-hotel-01");
    const passed2_2b = hotelItem2?.quantity === 2 && hotelItem2?.line_total === 450000 * 2;
    recordResult(
      "V2.2",
      "Per-night Calculation for 3-Day Itinerary (2 nights)",
      passed2_2b,
      `Quantity: ${hotelItem2?.quantity}, Line total: ${hotelItem2?.line_total}`
    );
  } catch (err) {
    recordResult("V2.2", "Per-night Calculation", false, err.message);
  }

  // 2.3: SQL Injection & Control Character Fuzzing on customerName, customerPhone, notes
  try {
    const q = await request("/api/quotes", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({ tourId: "tour-ds-03", adultsCount: 1 }),
    });

    const sqliPayload = "Robert'; DROP TABLE tour_bookings; --";
    const sqliRes = await request("/api/bookings", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        quoteReference: q.data.quote.quote_reference,
        customerName: sqliPayload,
        customerPhone: "0912345678",
        notes: "Test SQLi in notes: ' OR 1=1 --",
      }),
    });

    // Check table still exists and record is properly escaped
    const tableCheck = queryD1("SELECT count(*) as count FROM tour_bookings");
    const recordCheck = queryD1(`SELECT customer_name, notes FROM tour_bookings WHERE customer_name LIKE '%Robert%'`);

    const passed2_3 =
      sqliRes.status === 201 &&
      tableCheck.length > 0 &&
      recordCheck[0]?.customer_name === sqliPayload;

    recordResult(
      "V2.3",
      "SQL Injection payload in Customer Name & Notes",
      passed2_3,
      `HTTP ${sqliRes.status}, Table intact, Name stored verbatim without SQL execution`
    );

    // Test invalid phone number
    const qPhone = await request("/api/quotes", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({ tourId: "tour-ds-03", adultsCount: 1 }),
    });
    const badPhoneRes = await request("/api/bookings", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        quoteReference: qPhone.data.quote.quote_reference,
        customerName: "Valid Name",
        customerPhone: "NOT_A_PHONE_NUMBER",
      }),
    });
    const passedPhone = badPhoneRes.status === 400;
    recordResult("V2.3", "Invalid Phone Number Validation", passedPhone, `HTTP ${badPhoneRes.status}: ${badPhoneRes.data?.error}`);
  } catch (err) {
    recordResult("V2.3", "SQL Injection / Sanitization", false, err.message);
  }
}

async function runVector3_IdempotencyAndTenant() {
  console.log("\n==================================================");
  console.log("VECTOR 3: Idempotency & Tenant Isolation");
  console.log("==================================================");

  // 3.1: Cross-user idempotency collision attack
  try {
    const sharedKey = `shared-key-attack-${Date.now()}`;

    // User A creates booking with sharedKey
    const qA = await request("/api/quotes", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({ tourId: "tour-ds-02", adultsCount: 1 }),
    });
    const bA = await request("/api/bookings", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        quoteReference: qA.data.quote.quote_reference,
        customerName: "User A",
        customerPhone: "0911111111",
        idempotencyKey: sharedKey,
      }),
    });

    // User B tries to use the same idempotency key for creating their booking
    const qB = await request("/api/quotes", {
      method: "POST",
      headers: userBHeaders,
      body: JSON.stringify({ tourId: "tour-ds-02", adultsCount: 1 }),
    });
    const bB = await request("/api/bookings", {
      method: "POST",
      headers: userBHeaders,
      body: JSON.stringify({
        quoteReference: qB.data.quote.quote_reference,
        customerName: "User B Attacker",
        customerPhone: "0922222222",
        idempotencyKey: sharedKey,
      }),
    });

    const passed3_1 = bA.status === 201 && bB.status === 409 && bB.data?.error?.includes("Khóa định danh");
    recordResult(
      "V3.1",
      "Cross-User Idempotency Collision Attack",
      passed3_1,
      `User A: HTTP ${bA.status}, User B with same key: HTTP ${bB.status} (${bB.data?.error})`
    );

    // 3.2: Tenant Isolation: User B trying to access User A's booking
    const userA_BookingId = bA.data.booking.id;
    const leakAttempt = await request(`/api/bookings/${userA_BookingId}`, {
      method: "GET",
      headers: userBHeaders,
    });

    const passed3_2 = leakAttempt.status === 404;
    recordResult(
      "V3.2",
      "Tenant Isolation (User B reads User A Booking)",
      passed3_2,
      `HTTP ${leakAttempt.status}: ${leakAttempt.data?.error || "Accessed successfully (LEAK!)"}`
    );

    // User B trying to pay User A's booking
    const unauthorizedPay = await request(`/api/bookings/${userA_BookingId}/pay`, {
      method: "POST",
      headers: userBHeaders,
      body: JSON.stringify({ simulateStatus: "success" }),
    });
    const passed3_2b = unauthorizedPay.status === 404;
    recordResult(
      "V3.2",
      "Tenant Isolation (User B pays User A Booking)",
      passed3_2b,
      `HTTP ${unauthorizedPay.status}: ${unauthorizedPay.data?.error || "Paid successfully (UNAUTHORIZED!)"}`
    );

    // 3.3: Idempotency Payload Tampering Detection
    // User A reuses sharedKey but modifies customerName or phone
    const tamperedBooking = await request("/api/bookings", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        quoteReference: qA.data.quote.quote_reference,
        customerName: "Tampered Name",
        customerPhone: "0999999999",
        idempotencyKey: sharedKey,
      }),
    });
    const passed3_3 = tamperedBooking.status === 409 && tamperedBooking.data?.error?.includes("thông tin");
    recordResult(
      "V3.3",
      "Idempotency Payload Tampering Detection",
      passed3_3,
      `HTTP ${tamperedBooking.status}: ${tamperedBooking.data?.error}`
    );
  } catch (err) {
    recordResult("V3", "Idempotency & Tenant Isolation", false, err.message);
  }
}

async function runVector4_StateMachineAndFlags() {
  console.log("\n==================================================");
  console.log("VECTOR 4: Feature Flag & State Machine Tampering");
  console.log("==================================================");

  try {
    // Create and pay a booking
    const q = await request("/api/quotes", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({ tourId: "tour-ds-03", adultsCount: 1 }),
    });
    const b = await request("/api/bookings", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        quoteReference: q.data.quote.quote_reference,
        customerName: "State Machine Tester",
        customerPhone: "0912345678",
      }),
    });
    const bookingId = b.data.booking.id;

    // 4.1: Paying already paid booking
    await request(`/api/bookings/${bookingId}/pay`, {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({ simulateStatus: "success" }),
    });

    const secondPay = await request(`/api/bookings/${bookingId}/pay`, {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({ simulateStatus: "success" }),
    });
    const passed4_1 = secondPay.status === 409;
    recordResult("V4.1", "Paying Already Paid Booking", passed4_1, `HTTP ${secondPay.status}: ${secondPay.data?.error}`);

    // 4.2: User trying to cancel paid booking
    const userCancelPaid = await request(`/api/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({ reason: "User cancel paid" }),
    });
    const passed4_2 = userCancelPaid.status === 409;
    recordResult("V4.2", "User Cancelling Paid Booking", passed4_2, `HTTP ${userCancelPaid.status}: ${userCancelPaid.data?.error}`);

    // 4.3: Admin trying to direct-cancel paid booking without refund
    const adminCancelPaid = await request(`/api/admin/bookings/${bookingId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Admin direct cancel" }),
    });
    const passed4_3 = adminCancelPaid.status === 409;
    recordResult("V4.3", "Admin Direct-Cancelling Paid Booking (Must Refund)", passed4_3, `HTTP ${adminCancelPaid.status}: ${adminCancelPaid.data?.error}`);

    // 4.4: Admin refunding paid booking
    const adminRefund = await request(`/api/admin/bookings/${bookingId}/mock-refund`, {
      method: "POST",
      body: JSON.stringify({ reason: "Customer request refund" }),
    });
    const passed4_4 = adminRefund.status === 200 && adminRefund.data?.booking?.payment_status === "refunded";
    recordResult("V4.4", "Admin Mock-Refunding Paid Booking", passed4_4, `HTTP ${adminRefund.status}: Status=${adminRefund.data?.booking?.payment_status}`);

    // 4.5: Double refunding
    const doubleRefund = await request(`/api/admin/bookings/${bookingId}/mock-refund`, {
      method: "POST",
      body: JSON.stringify({ reason: "Double refund attempt" }),
    });
    const passed4_5 = doubleRefund.status === 409;
    recordResult("V4.5", "Double Refund Attempt", passed4_5, `HTTP ${doubleRefund.status}: ${doubleRefund.data?.error}`);

    // 4.6: Paying refunded booking
    const payRefunded = await request(`/api/bookings/${bookingId}/pay`, {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({ simulateStatus: "success" }),
    });
    const passed4_6 = payRefunded.status === 409;
    recordResult("V4.6", "Paying Refunded Booking", passed4_6, `HTTP ${payRefunded.status}: ${payRefunded.data?.error}`);

    // 4.7: Invalid simulateStatus ("pending", "unknown", "success;DROP TABLE")
    const qFresh = await request("/api/quotes", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({ tourId: "tour-ds-03", adultsCount: 1 }),
    });
    const bFresh = await request("/api/bookings", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        quoteReference: qFresh.data.quote.quote_reference,
        customerName: "Status Tamper Tester",
        customerPhone: "0912345678",
      }),
    });
    const badStatusRes = await request(`/api/bookings/${bFresh.data.booking.id}/pay`, {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({ simulateStatus: "invalid_status" }),
    });
    const passed4_7 = badStatusRes.status === 400;
    recordResult("V4.7", "Strict simulateStatus Validation", passed4_7, `HTTP ${badStatusRes.status}: ${badStatusRes.data?.error}`);
  } catch (err) {
    recordResult("V4", "State Machine Tampering", false, err.message);
  }
}

async function runVector5_RevenueReconciliation() {
  console.log("\n==================================================");
  console.log("VECTOR 5: Revenue Reconciliation & CSV Export");
  console.log("==================================================");

  try {
    // 5.1: Analytics API test
    const analyticsRes = await request("/api/admin/revenue/analytics?range=all");
    const analytics = analyticsRes.data;

    const netMatches = analytics.grossSimulatedRevenue - analytics.simulatedRefundedAmount === analytics.netSimulatedRevenue;
    recordResult(
      "V5.1",
      "Gross - Refunded = Net Revenue Invariant",
      netMatches,
      `Gross: ${analytics.grossSimulatedRevenue}, Refunded: ${analytics.simulatedRefundedAmount}, Net: ${analytics.netSimulatedRevenue}`
    );

    // 5.2: CSV Export verification
    const csvRes = await fetch(`${BASE_URL}/api/admin/revenue/export?range=all`);
    const csvBuf = await csvRes.arrayBuffer();
    const rawBytes = new Uint8Array(csvBuf);
    const hasUtf8Bom = rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF;
    const csvText = new TextDecoder("utf-8").decode(rawBytes);

    const hasCorrectHeader = csvText.includes("Mã đơn hàng,Khách hàng,Số điện thoại,Mã giao dịch,Loại giao dịch,Số tiền (VND),Đóng góp doanh thu thuần (VND),Thời gian (Giờ VN),Trạng thái,Ghi chú");

    recordResult("V5.2", "CSV Export UTF-8 BOM Header Check", hasUtf8Bom && hasCorrectHeader, `BOM Bytes=[0x${rawBytes[0].toString(16)}, 0x${rawBytes[1].toString(16)}, 0x${rawBytes[2].toString(16)}], HeaderOK=${hasCorrectHeader}`);

    // 5.3: CSV Formula Injection Test
    // Create a booking with dangerous formula string
    const qFormula = await request("/api/quotes", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({ tourId: "tour-ds-03", adultsCount: 1 }),
    });
    const formulaPayload = "=CMD|' /C calc'!A0";
    const bFormula = await request("/api/bookings", {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({
        quoteReference: qFormula.data.quote.quote_reference,
        customerName: formulaPayload,
        customerPhone: "0912345678",
      }),
    });
    await request(`/api/bookings/${bFormula.data.booking.id}/pay`, {
      method: "POST",
      headers: userAHeaders,
      body: JSON.stringify({ simulateStatus: "success" }),
    });

    const csvFormulaRes = await fetch(`${BASE_URL}/api/admin/revenue/export?range=all`);
    const csvFormulaText = await csvFormulaRes.text();

    // Check if formula is safely escaped with leading single quote: "'=CMD|..."
    const isEscaped = csvFormulaText.includes("\"'=CMD|' /C calc'!A0\"");
    recordResult(
      "V5.3",
      "CSV Formula Injection Sanitization",
      isEscaped,
      `Contains safely prefixed single quote: ${isEscaped}`
    );

    // 5.4: Reconciliation between CSV row sums and Analytics KPI
    const csvLines = csvFormulaText.replace(/^﻿/, "").trim().split("\r\n");
    let csvCalculatedNet = 0;
    for (let i = 1; i < csvLines.length; i++) {
      const parts = csvLines[i].split(",");
      // Column 6 (index 6) is net_contribution
      const netContrib = parseInt(parts[6], 10);
      if (!isNaN(netContrib)) {
        csvCalculatedNet += netContrib;
      }
    }

    const recheckAnalytics = await request("/api/admin/revenue/analytics?range=all");
    const actualNet = recheckAnalytics.data.netSimulatedRevenue;
    const passedReconcile = csvCalculatedNet === actualNet;
    recordResult(
      "V5.4",
      "Reconciliation: CSV Net Sum == Analytics Net Revenue",
      passedReconcile,
      `CSV Net Sum: ${csvCalculatedNet}, Analytics Net: ${actualNet}`
    );
  } catch (err) {
    recordResult("V5", "Revenue Reconciliation & CSV Export", false, err.message);
  }
}

async function main() {
  await runVector1_Concurrency();
  await runVector2_Fuzzing();
  await runVector3_IdempotencyAndTenant();
  await runVector4_StateMachineAndFlags();
  await runVector5_RevenueReconciliation();

  console.log("\n==================================================");
  console.log("FINAL AUDIT SUMMARY");
  console.log("==================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed > 0) {
    console.log("\nFAILED TESTS:");
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`- [${r.vector}] ${r.name}: ${r.details}`);
    });
  }
}

main().catch(console.error);
