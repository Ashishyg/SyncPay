// WhatsApp message templates. WhatsApp formatting: *bold*, _italic_, ```mono```.
// Kept as pure functions so wording can be changed (and tested) in one place.

const rupees = (paise) => '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// "15 Oct 2026, 9:42 pm" in India time, whatever the server's timezone
const when = (unixSec) => new Date(unixSec * 1000).toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
});

// Short payment reference people can quote to support (first 8 characters of the payment id)
const ref = (id) => String(id || '').slice(0, 8).toUpperCase();

export function otpMessage(code) {
  return [
    '*SyncPay verification code*',
    '',
    `Your code is *${code}*`,
    '',
    'It expires in 5 minutes.',
    '_Never share this code. SyncPay will never ask for it._',
  ].join('\n');
}

// To the person who received money
export function receivedMessage({ amount, fromName, id, ts, balance }) {
  return [
    '✅ *Payment received*',
    '',
    `*${rupees(amount)}* from *${fromName}*`,
    '',
    `Ref: ${ref(id)}`,
    `Paid: ${when(ts)}`,
    `Balance: *${rupees(balance)}*`,
  ].join('\n');
}

// To the person who paid, once their offline payment has settled
export function settledMessage({ amount, toName, id, ts, balance }) {
  return [
    '✅ *Payment settled*',
    '',
    toName ? `*${rupees(amount)}* to *${toName}*` : `*${rupees(amount)}* paid by QR`,
    '',
    `Ref: ${ref(id)}`,
    `Paid: ${when(ts)}`,
    `Balance: *${rupees(balance)}*`,
    ...(toName ? [] : ['', '_The receiver gets it when they next sync._']),
  ].join('\n');
}
