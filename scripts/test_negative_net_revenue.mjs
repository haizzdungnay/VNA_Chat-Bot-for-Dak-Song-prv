import { request, queryD1, userAHeaders } from "./independent_audit.mjs";

async function testHistoricalRefundScenario() {
  console.log("=== TESTING NEGATIVE NET REVENUE SCENARIO ===");

  // 1. Create a booking for 1,000,000 VND
  const q = await request("/api/quotes", {
    method: "POST",
    headers: userAHeaders,
    body: JSON.stringify({ tourId: "tour-ds-03", adultsCount: 2 }), // 500,000 * 2 = 1,000,000 VND
  });

  const b = await request("/api/bookings", {
    method: "POST",
    headers: userAHeaders,
    body: JSON.stringify({
      quoteReference: q.data.quote.quote_reference,
      customerName: "Historical Payer",
      customerPhone: "0912345678",
    }),
  });

  const bookingId = b.data.booking.id;

  // Pay it
  const payRes = await request(`/api/bookings/${bookingId}/pay`, {
    method: "POST",
    headers: userAHeaders,
    body: JSON.stringify({ simulateStatus: "success" }),
  });

  // Now, in DB D1, backdate the mock_payment_attempt and tour_booking created_at to YESTERDAY (24 hours ago)
  const yesterdayUtc = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
  queryD1(`UPDATE mock_payment_attempts SET created_at = '${yesterdayUtc}' WHERE booking_id = '${bookingId}'`);
  queryD1(`UPDATE tour_bookings SET created_at = '${yesterdayUtc}' WHERE id = '${bookingId}'`);

  // Now, perform mock refund TODAY via Admin API
  const refundRes = await request(`/api/admin/bookings/${bookingId}/mock-refund`, {
    method: "POST",
    body: JSON.stringify({ reason: "Refund today for yesterday payment" }),
  });

  console.log("Refund HTTP Status:", refundRes.status);

  // Now query analytics for TODAY
  const analyticsToday = await request("/api/admin/revenue/analytics?range=today");
  console.log("Today Analytics:", JSON.stringify(analyticsToday.data, null, 2));

  const grossToday = analyticsToday.data.grossSimulatedRevenue;
  const refundToday = analyticsToday.data.simulatedRefundedAmount;
  const netToday = analyticsToday.data.netSimulatedRevenue;

  console.log(`\nResults for 'today':`);
  console.log(`Gross Today: ${grossToday} VND`);
  console.log(`Refund Today: ${refundToday} VND`);
  console.log(`Net Today: ${netToday} VND`);

  const passed = netToday < 0 && netToday === grossToday - refundToday;
  console.log(`Net revenue allowed to be negative: ${passed ? "PASS" : "FAIL"}`);
}

testHistoricalRefundScenario().catch(console.error);
