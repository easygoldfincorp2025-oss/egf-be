const PaymentInOutModel = require("../models/payment-in-out");
const PartyModel = require("../models/party");

async function updatePartyBalance(party) {
    const payments = await PaymentInOutModel.find({
        party: party,
        deleted_at: null
    });

    const balance = payments.reduce((acc, payment) => {
        const cash = Number(payment.paymentDetail?.cashAmount || 0);
        const bank = Number(payment.paymentDetail?.bankAmount || 0);
        const total = cash + bank;

        return acc + (payment.status === "Payment Out" ? total : -total);
    }, 0);

    await PartyModel.findByIdAndUpdate(party, {amount: balance});

    return balance
}

module.exports = {updatePartyBalance};