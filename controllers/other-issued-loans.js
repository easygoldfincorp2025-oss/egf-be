const mongoose = require("mongoose");
const OtherIssuedLoanModel = require("../models/other-issued-loan");
const OtherLoanInterestModel = require("../models/other-loan-interest-payment");
const OtherLoanCloseModel = require("../models/other-loan-close");
const {getCurrentFinancialYear} = require("./issue-loan");
const IssuedLoanModel = require("../models/issued-loan");
const ChargeInOutModel = require("../models/charge-in-out");

async function addOtherLoan(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {companyId} = req.params

        const issuedLoan = await OtherIssuedLoanModel.create({
            ...req.body,
            company: companyId,
            otherLoanNumber: await generateLoanNumber(companyId),
            otherLoanAmount: req.body.amount
        })
        await issuedLoan.save({session});
        await session.commitTransaction();
        await session.endSession();

        return res.status(201).json({status: 201, message: "Other Loan issued successfully", data: issuedLoan});
    } catch (err) {
        await session.abortTransaction();
        await session.endSession();
        console.error(err);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}

async function getAllOtherLoans(req, res) {
    try {
        const {companyId} = req.params
        const {branch} = req.query

        let query = {
            company: companyId,
            deleted_at: null
        }

        let loans = await OtherIssuedLoanModel.find(query)
            .populate({path: 'loan', populate: [{path: 'company'},{path: 'scheme'},{path: 'closedBy'},{path: 'issuedBy'},{path: 'customer', populate: {path: 'branch'}}]})
            .sort({ createdAt: -1 });

        if (branch) {
            loans = loans.filter(loan =>
                loan.loan.customer?.branch?._id.toString() === branch
            );
        }

        return res.status(200).json({status: 200, data: loans});
    } catch (err) {
        console.error("Error fetching loans:", err.message);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}

async function updateOtherLoan(req, res) {
    try {
        const {loanId} = req.params;

        let payload = req.body

        const updatedLoan = await OtherIssuedLoanModel.findByIdAndUpdate(loanId, {
            ...payload,
            otherLoanAmount: payload?.amount
        }, {new: true});

        if (!updatedLoan) {
            return res.status(404).json({status: 404, message: "Other Loan details not found."});
        }

        return res.status(200).json({status: 200, data: updatedLoan, message: "Other Loan updated successfully"});
    } catch (err) {
        console.error(err);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}

async function getSingleOtherLoan(req, res) {
    const {loanId} = req.params;

    try {
        const loan = await OtherIssuedLoanModel.findById(loanId)
            .populate("customer")
            .populate("scheme");

        if (!loan) {
            return res.status(404).json({status: 404, message: "Other Loan Details not found"});
        }

        return res.status(200).json({status: 200, data: loan});
    } catch (err) {
        console.error("Error fetching loan:", err.message);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}

async function deleteOtherLoan(req, res) {
    try {
        const {loanId} = req.params;

        await OtherIssuedLoanModel.findByIdAndUpdate(loanId, {deleted_at: new Date()}, {new: true})
        await ChargeInOutModel.deleteMany({ otherLoanId: loanId })

        return res.status(200).json({status: 200, message: "Other Loan deleted successfully"});
    } catch (err) {
        console.error(err);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}

async function otherLoanInterestPayment(req,res){
    try{
        const {loanId} = req.params;

        const interestDetails = await OtherLoanInterestModel.create({...req.body, otherLoan: loanId})

        return res.status(200).json({status: 200, message: "Interest payment success", data: interestDetails});

    }catch (e) {
        console.error(e)
        return res.json({status: 500, message: "Internal server error"});
    }
}

async function getAllInterestsOfOtherLoan(req,res){
    try{
        const {loanId} = req.params;

        const interestDetails = await OtherLoanInterestModel.find({otherLoan: loanId}).populate("otherLoan").sort({createdAt: -1})

        return res.status(200).json({status: 200, data: interestDetails});

    }catch (e) {
        console.error(e)
        return res.json({status: 500, message: "Internal server error"});
    }
}

async function deleteOtherLoanInterest(req,res){
    try{
        const {id} = req.params;

        const interestDetails = await OtherLoanInterestModel.findByIdAndDelete(id, req.body, {new: true})

        return res.status(200).json({status: 200, data: interestDetails, message: "Other Loans interest details updated successfully"});

    }catch (e) {
        console.error(e)
        return res.json({status: 500, message: "Internal server error"});
    }
}

async function otherLoanClose(req,res){
    try{
        const {loanId} = req.params;

        const loanDetails = await OtherLoanCloseModel.create({...req.body, otherLoan: loanId})

        await OtherIssuedLoanModel.findByIdAndUpdate(loanId, {status: "Closed", interestAmount: 0, closingAmount: req.body.paidLoanAmount, closeDate: req.body.payDate, closingCharge: req.body.closingCharge, amount: 0}, {new: true})

        return res.status(200).json({status: 200, message: "Other loan closed successfully", data: loanDetails});

    }catch (e) {
        console.error(e)
        return res.json({status: 500, message: "Internal server error"});
    }
}

async function getClosedOtherLoan(req,res){
    try{
        const {loanId} = req.params;

        const loanDetails = await OtherLoanCloseModel.find({otherLoan: loanId}).populate("otherLoan")

        return res.status(200).json({status: 200, data: loanDetails});

    }catch (e) {
        console.error(e)
        return res.json({status: 500, message: "Internal server error"});
    }
}

async function deleteOtherLoanClosingDetails(req, res) {
    try {
        const {id, loanId} = req.params;

        const closingDetail = await OtherLoanCloseModel.findByIdAndDelete(id);
        if (!closingDetail) {
            return res.status(404).json({status: 404, message: "Loan closing detail not found"});
        }

        const restoredAmount = closingDetail.totalLoanAmount || 0;

        const updatedLoan = await OtherIssuedLoanModel.findByIdAndUpdate(
            loanId,
            {
                status: "issued",
                $inc: {amount: restoredAmount}
            },
            {new: true}
        );

        if (!updatedLoan) {
            return res.status(404).json({status: 404, message: "Issued loan not found"});
        }

        return res.status(200).json({
            status: 200,
            message: "Loan close detail deleted and loan amount restored successfully"
        });

    } catch (e) {
        console.error(e);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}

const generateLoanNumber = async (companyId) => {
    const financialYear = getCurrentFinancialYear();

    const loanCount = await OtherIssuedLoanModel.countDocuments({
        company: companyId,
        otherNumber: {$regex: `^EGF/${financialYear}`}
    });

    const newLoanCount = loanCount + 1;

    return `EGF/${financialYear}_${String(newLoanCount).padStart(6, '0')}`;
};

module.exports = {addOtherLoan, getAllOtherLoans, getSingleOtherLoan, deleteOtherLoan, updateOtherLoan, otherLoanInterestPayment, getAllInterestsOfOtherLoan, deleteOtherLoanInterest, otherLoanClose, getClosedOtherLoan, deleteOtherLoanClosingDetails};