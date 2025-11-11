const PaymentInOutModel = require("../models/payment-in-out");
const PartyModel = require("../models/party");

async function updatePartyBalance(partyId) {
    const payments = await PaymentInOutModel.find({
        party: partyId,
        deleted_at: null
    });

    if (!payments || payments.length === 0) {
        await PartyModel.findByIdAndUpdate(partyId, { amount: 0 });
        return 0;
    }

    let balance = 0;
    for (const payment of payments) {
        const cash = Number(payment.paymentDetail?.cashAmount || 0);
        const bank = Number(payment.paymentDetail?.bankAmount || 0);
        const total = cash + bank;

        if (payment.status === "Payment Out") {
            balance += total;
        } else if (payment.status === "Payment In") {
            balance -= total;
        }
    }

    await PartyModel.findByIdAndUpdate(partyId, { amount: balance });
    return balance;
}

module.exports = { updatePartyBalance };
