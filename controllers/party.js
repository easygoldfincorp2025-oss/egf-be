const PartyModel = require("../models/party");
const PaymentInOutModel = require("../models/payment-in-out");


async function addParty(req, res) {
    try {
        const { companyId } = req.params;

        const party = await PartyModel.create({...req.body, company: companyId});

        return res.status(201).json({ status: 201, message: "Party created successfully", data: party });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 500, message: "Internal server error" });
    }
}

async function getAllParties(req, res) {
    const { companyId } = req.params;
    const {branchId} = req.query;

    try {
        const query = { company: companyId };
        if (branchId) query.branch = branchId;

        const parties = await PartyModel.find(query).lean();

        const partiesWithBalance = await Promise.all(
            parties.map(async (party) => {
                const payments = await PaymentInOutModel.find({
                    party: party._id,
                    deleted_at: null,
                });

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

                return {
                    ...party,
                    finalBalance: balance,
                };
            })
        );

        return res.status(200).json({
            status: 200,
            data: partiesWithBalance,
        });
    } catch (err) {
        console.error("Error fetching parties:", err.message);
        return res.status(500).json({
            status: 500,
            message: "Internal server error",
        });
    }
}

async function updateParty(req, res) {
    try {
        const { partyId } = req.params;

        const updatedParty = await PartyModel.findByIdAndUpdate(partyId, req.body, { new: true });

        return res.status(200).json({ status: 200, message: "Party updated successfully", data: updatedParty });
    } catch (err) {
        console.error("Error updating party:", err.message);
        return res.status(500).json({ status: 500, message: "Internal server error" });
    }
}

async function getSingleParty(req, res) {
    const { partyId } = req.params;

    try {
        const party = await PartyModel.findById(partyId)
            .populate('company')
            .populate('branch');

        return res.status(200).json({ status: 200, data: party });
    } catch (err) {
        console.error("Error fetching party:", err.message);
        return res.status(500).json({ status: 500, message: "Internal server error" });
    }
}

async function deleteParty(req, res) {
    try {
        const { partyId } = req.params;

        await PartyModel.findByIdAndDelete(partyId);

        return res.status(200).json({ status: 200, message: "Party deleted successfully." });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 500, message: "Internal server error" });
    }
}

module.exports = {
    addParty,
    getAllParties,
    updateParty,
    getSingleParty,
    deleteParty
};
