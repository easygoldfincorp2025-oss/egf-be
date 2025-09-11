const PaymentInOutModel = require("../models/payment-in-out");
const CompanyModel = require("../models/company");
const PartyModel = require("../models/party");
const {uploadFile} = require("../helpers/avatar");
const {uploadDir} = require("../constant");
const {sendWhatsAppMessage} = require("./common");
const {updatePartyBalance} = require("../helpers/party");
const ConfigModel = require("../models/config");

async function validateCompany(companyId) {
    return await CompanyModel.findById(companyId);
}

function getFinancialYear(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const startYear = month >= 4 ? year : year - 1;
    const endYear = (startYear + 1).toString().slice(-2);
    return `${startYear.toString().slice(-2)}-${endYear}`;
}

async function generateReceiptNo() {
    const financialYear = getFinancialYear();
    const regex = new RegExp(`^EGF/${financialYear}/(\\d+)$`);

    const latest = await PaymentInOutModel.findOne({receiptNo: {$regex: regex}})
        .sort({createdAt: -1});

    let nextNumber = 1;
    if (latest && latest.receiptNo) {
        const match = latest.receiptNo.match(/\/(\d+)$/);
        if (match) {
            nextNumber = parseInt(match[1]) + 1;
        }
    }

    const padded = String(nextNumber).padStart(4, '0');
    return `EGF/${financialYear}/${padded}`;
}

async function addPaymentInOut(req, res) {
    try {
        const { companyId } = req.params;

        const company = await validateCompany(companyId);
        if (!company) {
            return res.status(404).json({ status: 404, message: "Company not found" });
        }

        const invoice = req.file?.buffer
            ? await uploadFile(req.file.buffer, uploadDir.PAYMENT_IN_OUT, req.file.originalname)
            : "";

        const receiptNo = await generateReceiptNo();

        const { receiptNo: _unused, ...paymentData } = req.body;

        const paymentInOut = await PaymentInOutModel.create({
            ...paymentData,
            company: companyId,
            invoice,
            receiptNo
        });

        const remainingBalance = await updatePartyBalance(paymentData.party);

        const party = await PartyModel.findById(paymentData.party).select("name contact");
        if (!party) {
            return res.status(400).json({ status: 400, message: "Invalid party" });
        }

        const amount = paymentData.paymentDetail?.cashAmount ?? paymentData.paymentDetail?.bankAmount ?? 0;

        const type = paymentData.status === "Payment In" ? "payment_in_1" : "payment_out_1";
        await sendWhatsAppNotification({
            contact: party.contact,
            party: party.name,
            company,
            amount,
            remainingBalance,
            type,
        });

        const config = await ConfigModel.findOne({ company: companyId }).select("whatsappConfig");
        const contacts = [config?.whatsappConfig?.contact1, config?.whatsappConfig?.contact2].filter(Boolean);

        const selfType = paymentData.status === "Payment In" ? "payment_in_self" : "payment_out_self";
        await Promise.all(
            contacts.map((contact) =>
                sendWhatsAppSelfNotification({
                    contact,
                    party: party.name,
                    amount,
                    remainingBalance,
                    company,
                    type: selfType,
                })
            )
        );

        return res.status(201).json({
            status: 201,
            message: "Payment In/Out created successfully",
            data: paymentInOut,
        });

    } catch (err) {
        console.error("Error in addPaymentInOut:", err);
        return res.status(500).json({ status: 500, message: "Internal server error" });
    }
}


async function getAllPaymentInOut(req, res) {
    try {
        const {companyId} = req.params;
        const {branchId} = req.query;

        const company = await validateCompany(companyId);
        if (!company) {
            return res.status(404).json({status: 404, message: "Company not found"});
        }

        const query = {company: companyId, deleted_at: null};
        if (branchId) query.branch = branchId;

        const payments = await PaymentInOutModel.find(query)
            .populate('company')
            .populate('branch')
            .populate('party')
            .sort({date: -1});

        return res.status(200).json({status: 200, data: payments});
    } catch (err) {
        console.error("Error fetching payments:", err.message);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}

async function getSinglePaymentInOut(req, res) {
    try {
        const {companyId, paymentId} = req.params;

        const company = await validateCompany(companyId);
        if (!company) {
            return res.status(404).json({status: 404, message: "Company not found"});
        }

        const payment = await PaymentInOutModel.findOne({_id: paymentId, company: companyId, deleted_at: null})
            .populate('company')
            .populate('branch')
            .populate('party');

        if (!payment) {
            return res.status(404).json({status: 404, message: "Payment not found"});
        }

        return res.status(200).json({status: 200, data: payment});
    } catch (err) {
        console.error("Error fetching payment:", err.message);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}

async function updatePaymentInOut(req, res) {
    try {
        const {companyId, paymentId} = req.params;

        const company = await validateCompany(companyId);
        if (!company) {
            return res.status(404).json({status: 404, message: "Company not found"});
        }

        const invoice = req.file && req.file.buffer
            ? await uploadFile(req.file.buffer, uploadDir.PAYMENT_IN_OUT, req.file.originalname)
            : '';

        const payload = {...req.body};
        if (invoice) payload.invoice = invoice;

        const updatedPayment = await PaymentInOutModel.findOneAndUpdate(
            {_id: paymentId, company: companyId, deleted_at: null},
            payload,
            {new: true}
        );

        if (!updatedPayment) {
            return res.status(404).json({status: 404, message: "Payment not found or already deleted"});
        }

        return res.status(200).json({
            status: 200,
            message: "Payment In/Out updated successfully",
            data: updatedPayment
        });
    } catch (err) {
        console.error("Error updating payment:", err.message);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}

async function deletePaymentInOut(req, res) {
    try {
        const {companyId, paymentId} = req.params;

        const company = await validateCompany(companyId);
        if (!company) {
            return res.status(404).json({status: 404, message: "Company not found"});
        }

        const deleted = await PaymentInOutModel.findOneAndUpdate(
            {_id: paymentId, company: companyId, deleted_at: null},
            {deleted_at: new Date()},
            {new: true}
        );

        if (!deleted) {
            return res.status(404).json({status: 404, message: "Payment not found or already deleted"});
        }

        return res.status(200).json({
            status: 200,
            message: "Payment soft deleted successfully",
            data: deleted,
        });
    } catch (err) {
        console.error("Error deleting payment:", err.message);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}

const sendWhatsAppNotification = async ({
                                            contact,
                                            party,
                                            amount,
                                            remainingBalance,
                                            company,
                                            type
                                        }) => {
    const formData = new FormData();
    formData.append("authToken", process.env.WHATSAPP_API_AUTH_TOKEN);
    formData.append("name", party);
    formData.append("sendto", `91${contact}`);
    formData.append("originWebsite", process.env.WHATSAPP_API_ORIGIN_WEBSITE);
    formData.append("templateName", type);
    formData.append("language", process.env.WHATSAPP_API_TEMPLATE_LANGUAGE);
    formData.append("headerdata", company.name);
    formData.append("data[0]", party);
    formData.append("data[1]", company.name);
    formData.append("data[2]", amount);
    formData.append("data[3]", remainingBalance);

    await sendWhatsAppMessage(formData);
};

const sendWhatsAppSelfNotification = async ({
                                                contact,
                                                party,
                                                amount,
                                                remainingBalance,
                                                company,
                                                type
                                            }) => {
    const formData = new FormData();
    formData.append("authToken", process.env.WHATSAPP_API_AUTH_TOKEN);
    formData.append("name", company.name);
    formData.append("sendto", `91${contact}`);
    formData.append("originWebsite", process.env.WHATSAPP_API_ORIGIN_WEBSITE);
    formData.append("templateName", type);
    formData.append("language", process.env.WHATSAPP_API_TEMPLATE_LANGUAGE);
    formData.append("headerdata", company.name);
    formData.append("data[0]", amount);
    formData.append("data[1]", party);
    formData.append("data[2]", remainingBalance);
    await sendWhatsAppMessage(formData);
};

module.exports = {
    addPaymentInOut,
    getAllPaymentInOut,
    getSinglePaymentInOut,
    updatePaymentInOut,
    deletePaymentInOut
};
