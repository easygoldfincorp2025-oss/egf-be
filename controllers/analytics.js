const IssuedLoanModel = require("../models/issued-loan");
const InterestModel = require("../models/interest");
const UchakInterestModel = require("../models/uchak-interest-payment");
const PartReleaseModel = require("../models/part-release");
const PartPaymentModel = require("../models/loan-part-payment");
const ClosedLoanModel = require("../models/loan-close");
const OtherIssuedLoanModel = require("../models/other-issued-loan");
const OtherLoanInterestModel = require("../models/other-loan-interest-payment");
const ClosedOtherLoanModel = require("../models/other-loan-close");
const CompanyModel = require("../models/company");
const ExpenseModel = require("../models/expense");
const OtherIncomeModel = require("../models/other-income");
const ChargeInOutModel = require("../models/charge-in-out");
const PaymentInOutModel = require("../models/payment-in-out");
const TransferModel = require("../models/transfer");

async function allTransactions(req, res) {
    try {
        const {companyId} = req.params;

        const models = [
            {
                model: IssuedLoanModel,
                query: {deleted_at: null, company: companyId},
                fields: ['cashAmount', 'issueDate', 'loanNo'],
                type: "Loan issued",
                category: "Payment Out",
                dateField: 'issueDate',
                populate: 'customer'
            },
            {
                model: InterestModel,
                query: {deleted_at: null},
                fields: ['paymentDetail', 'createdAt'],
                type: "Customer Interest",
                category: "Payment In",
                dateField: 'createdAt',
                populate: {path: 'loan', populate: 'customer'},
                filter: item => item?.loan?.company?.toString() === companyId
            },
            {
                model: PartReleaseModel,
                query: {deleted_at: null},
                fields: ['paymentDetail', 'date'],
                type: "Part Release",
                category: "Payment In",
                dateField: 'date',
                populate: {path: 'loan', populate: 'customer'},
                filter: item => item?.loan?.company?.toString() === companyId
            },
            {
                model: PartPaymentModel,
                query: {deleted_at: null},
                fields: ['paymentDetail', 'date'],
                type: "Loan Part Payment",
                category: "Payment In",
                dateField: 'date',
                populate: {path: 'loan', populate: 'customer'},
                filter: item => item?.loan?.company?.toString() === companyId
            },
            {
                model: UchakInterestModel,
                query: {deleted_at: null},
                fields: ['paymentDetail', 'date'],
                type: "Uchak Interest",
                category: "Payment In",
                dateField: 'date',
                populate: {path: 'loan', populate: 'customer'},
                filter: item => item?.loan?.company?.toString() === companyId
            },
            {
                model: ClosedLoanModel,
                query: {deleted_at: null},
                fields: ['paymentDetail', 'date'],
                type: "Customer Loan Close",
                category: "Payment In",
                dateField: 'date',
                populate: {path: 'loan', populate: 'customer'},
                filter: item => item?.loan?.company?.toString() === companyId
            },
            {
                model: OtherIssuedLoanModel,
                query: {deleted_at: null, company: companyId},
                fields: ['cashAmount', 'date', 'otherNumber', 'loan'],
                type: "Other Loan Issued",
                category: "Payment In",
                dateField: 'date',
                populate: 'company'
            },
            {
                model: OtherLoanInterestModel,
                query: {deleted_at: null},
                fields: ['paymentDetail', 'payDate', 'otherLoan'],
                type: "Other Loan Interest",
                category: "Payment Out",
                dateField: 'payDate',
                populate: 'otherLoan',
                filter: item => item?.otherLoan?.company?.toString() === companyId
            },
            {
                model: ClosedOtherLoanModel,
                query: {deleted_at: null},
                fields: ['paymentDetail', 'payDate', 'otherLoan'],
                type: "Other Loan Close",
                category: "Payment Out",
                dateField: 'payDate',
                populate: {
                    path: 'otherLoan',
                    populate: {
                        path: 'loan',
                        populate: {path: 'customer'}
                    }
                },
                filter: item => item?.otherLoan?.company?.toString() === companyId
            },
            {
                model: ExpenseModel,
                query: {company: companyId, deleted_at: null},
                fields: ['paymentDetail', 'date', 'expenseType', 'category', 'description'],
                type: "Expense",
                category: "Payment Out",
                dateField: 'date',
            },
            {
                model: OtherIncomeModel,
                query: {company: companyId, deleted_at: null},
                fields: ['paymentDetail', 'date', 'incomeType', 'category', 'description'],
                type: "Other Income",
                category: "Payment In",
                dateField: 'date',
            },
            {
                model: ChargeInOutModel,
                query: {company: companyId, deleted_at: null},
                fields: ['chargeType', 'status', 'description', 'category', 'date', 'paymentDetail'],
                type: 'Charge In/Out',
                categoryField: 'status',
                dateField: 'date',
            },
            {
                model: PaymentInOutModel,
                query: {company: companyId, deleted_at: null},
                fields: ['party', 'status', 'description', 'date', 'paymentDetail'],
                type: 'Payment In/Out',
                categoryField: 'status',
                dateField: 'date',
                populate: 'party',
            }
        ];

        const results = await Promise.all(
            models.map(async ({model, query, fields, populate, filter}) => {
                let queryExec = model.find(query).select(fields.join(' ')).lean();
                if (populate) queryExec = queryExec.populate(populate);
                let data = await queryExec;
                return filter ? data.filter(filter) : data;
            })
        );

        const validTransferTypes = ['Adjustment', 'Cash To Bank', 'Bank To Cash'];

        const transfers = (await TransferModel.find({company: companyId, deleted_at: null}) || [])
            .filter(e => validTransferTypes.includes(e.transferType))
            .map(e => {
                const isPaymentIn =
                    (e.transferType === 'Adjustment' && e.paymentDetail?.adjustmentType === 'Add Cash') ||
                    e.transferType === 'Bank To Cash';

                const commonFields = {
                    status: e.transferType,
                    date: e.transferDate,
                    amount: e.paymentDetail?.amount ?? 0,
                    paymentDetail: e.paymentDetail
                };

                if (isPaymentIn) {
                    return {
                        ...commonFields,
                        _id: e?._id,
                        category: 'Payment In',
                        ref: e.transferType === 'Bank To Cash'
                            ? 'Bank to cash transfer'
                            : e.desc,
                        detail: e.transferType === 'Bank To Cash'
                            ? `${e.paymentDetail?.from?.bankName}(${e.paymentDetail?.from?.accountHolderName}) To cash`
                            : 'Add Cash for Adjustment',
                    };
                } else {
                    return {
                        ...commonFields,
                        _id: e?._id,
                        category: 'Payment Out',
                        ref: e.transferType === 'Cash To Bank'
                            ? 'Cash to Bank transfer'
                            : e.desc,
                        detail: e.transferType === 'Cash To Bank'
                            ? `Cash deposit to ${e.paymentDetail?.to?.bankName}(${e.paymentDetail?.to?.accountHolderName})`
                            : `Reduce Cash for Adjustment`,
                    };
                }
            });

        const transactions = results.flatMap((data, index) =>
            (Array.isArray(data) ? data : []).map(entry => ({
                category: models[index]?.categoryField ? entry[models[index].categoryField] : (models[index]?.category ?? 'Unknown'),
                ref: entry?.otherNumber ??
                    entry?.loanNo ??
                    entry?.loan?.loanNo ??
                    entry?.otherLoan?.otherNumber ??
                    entry?.category ??
                    entry?.description ?? '',
                detail: entry?.chargeType ??
                    entry?.party?.name ??
                    `${entry?.customer?.firstName ??
                    entry?.loan?.customer?.firstName ??
                    entry?.otherName ??
                    entry?.expenseType ??
                    `${entry?.otherLoan?.loan?.customer?.firstName}` + `${(entry?.otherLoan?.loan?.customer?.lastName) || ''}` ??
                    entry?.incomeType}` + ` ${(entry?.customer?.lastName ?? entry?.loan?.customer?.lastName) || ''}` ??
                    null,
                status: models[index]?.type,
                date: entry[models[index]?.dateField] ??
                    null,
                amount: Number(entry?.cashAmount ??
                    entry?.paymentDetail?.cashAmount ??
                    entry?.paymentDetails?.chargeCashAmount ??
                    entry?.paymentDetails?.cashAmount ?? 0),
                paymentDetail: entry?.paymentDetail ??
                    entry?.paymentDetails ?? {},
                allCategory: entry?.category ?? "",
            }))
        );

        const allData = [...transactions, ...transfers]
            .filter(e => e?.amount !== 0)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        res.status(200).json({
            status: 200,
            message: "All transactions fetched successfully",
            data: allData
        });

    } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({status: 500, message: "Internal server error"});
    }
}

function getAccountHolderName(bankAccs, accNumber, bankName = '') {
    const Account = accNumber && bankAccs?.find((e) => (e?.accountNumber === accNumber));
    return Account?.accountHolderName
}

function getBankName(bankAccs, accNumber, holderName = '') {
    const Account = accNumber && bankAccs?.find((e) => (e?.accountNumber === accNumber));
    console.log(Account,"0000000")
    return Account?.bankName
}

async function allBankTransactions(req, res) {

    try {
        const {companyId} = req.params;

        const models = [
            {
                model: IssuedLoanModel,
                query: {deleted_at: null, company: companyId},
                fields: ['bankAmount', 'issueDate', 'companyBankDetail', 'loanNo'],
                type: "Loan issued",
                category: "Payment Out",
                dateField: 'issueDate',
                populate: 'customer company'
            },
            {
                model: InterestModel,
                query: {deleted_at: null},
                fields: ['paymentDetail', 'createdAt'],
                type: "Customer Interest",
                category: "Payment In",
                dateField: 'createdAt',
                populate: {
                    path: 'loan',
                    populate: [
                        {path: 'customer'},
                        {path: 'company'}
                    ]
                },
                filter: item => item?.loan?.company?._id?.toString() === companyId
            },
            {
                model: PartReleaseModel,
                query: {deleted_at: null},
                fields: ['paymentDetail', 'date'],
                type: "Part Release",
                category: "Payment In",
                dateField: 'date',
                populate: {
                    path: 'loan',
                    populate: [
                        {path: 'customer'},
                        {path: 'company'}
                    ]
                },
                filter: item => item?.loan?.company?._id?.toString() === companyId
            },
            {
                model: PartPaymentModel,
                query: {deleted_at: null},
                fields: ['paymentDetail', 'date'],
                type: "Loan Part Payment",
                category: "Payment In",
                dateField: 'date',
                populate: {
                    path: 'loan',
                    populate: [
                        {path: 'customer'},
                        {path: 'company'}
                    ]
                },
                filter: item => item?.loan?.company?._id?.toString() === companyId
            },
            {
                model: UchakInterestModel,
                query: {deleted_at: null},
                fields: ['paymentDetail', 'date'],
                type: "Uchak Interest",
                category: "Payment In",
                dateField: 'date',
                populate: {
                    path: 'loan',
                    populate: [
                        {path: 'customer'},
                        {path: 'company'}
                    ]
                },
                filter: item => item?.loan?.company?._id?.toString() === companyId
            },
            {
                model: ClosedLoanModel,
                query: {deleted_at: null},
                fields: ['paymentDetail', 'date'],
                type: "Customer Loan Close",
                category: "Payment In",
                dateField: 'date',
                populate: {
                    path: 'loan',
                    populate: [
                        {path: 'customer'},
                        {path: 'company'}
                    ]
                },
                filter: item => item?.loan?.company?._id?.toString() === companyId
            },
            {
                model: OtherIssuedLoanModel,
                query: {deleted_at: null, company: companyId},
                fields: ['bankAmount', 'date', 'otherNumber', 'loan', 'bankDetails', 'otherName', 'otherCharge'],
                type: "Other Loan Issued",
                category: "Payment In",
                dateField: 'date',
                populate: "company"
            },
            {
                model: OtherLoanInterestModel,
                query: {deleted_at: null},
                fields: ['paymentDetail', 'to', 'payDate', 'otherLoan', 'charge'],
                type: "Other Loan Interest",
                category: "Payment Out",
                dateField: 'to',
                populate: {
                    path: 'otherLoan',
                    populate: [
                        {path: 'company'}
                    ]
                },
                filter: item => item?.otherLoan?.company?._id?.toString() === companyId
            },
            {
                model: ClosedOtherLoanModel,
                query: {deleted_at: null},
                fields: ['paymentDetail', 'payDate', 'otherLoan'],
                type: "Other Loan Close",
                category: "Payment Out",
                dateField: 'payDate',
                populate: {
                    path: 'otherLoan',
                    populate: [
                        {path: 'company'}
                    ]
                },
                filter: item => item?.otherLoan?.company?._id?.toString() === companyId
            },
            {
                model: ExpenseModel,
                query: {company: companyId, deleted_at: null},
                fields: ['paymentDetail', 'date', 'expenseType', 'category', 'description'],
                type: "Expense",
                category: "Payment Out",
                dateField: 'date',
                populate: 'company'
            },
            {
                model: OtherIncomeModel,
                query: {company: companyId, deleted_at: null},
                fields: ['paymentDetail', 'date', 'incomeType', 'category', 'description'],
                type: "Other Income",
                category: "Payment In",
                dateField: 'date',
                populate: 'company'
            },
            {
                model: ChargeInOutModel,
                query: {company: companyId, deleted_at: null},
                fields: ['chargeType', 'status', 'description', 'category', 'date', 'paymentDetail'],
                type: 'Charge In/Out',
                categoryField: 'status',
                dateField: 'date',
                populate: 'company'
            },
            {
                model: PaymentInOutModel,
                query: {company: companyId, deleted_at: null},
                fields: ['party', 'status', 'description', 'date', 'paymentDetail'],
                type: 'Payment In/Out',
                categoryField: 'status',
                dateField: 'date',
                populate: [{path:'party'}, {path: 'company'}],
            },
        ];

        const results = await Promise.all(
            models.map(async ({model, query, fields, populate, filter}) => {
                let queryExec = model.find(query).select(fields.join(' ')).lean();
                if (populate) queryExec = queryExec.populate(populate);
                let data = await queryExec;
                return filter ? data.filter(filter) : data;
            })
        );

        const validTransferTypes = ['Adjust Bank Balance', 'Cash To Bank', 'Bank To Cash', 'Bank To Bank'];

        const transfers = (await TransferModel.find({company: companyId, deleted_at: null}).populate('company') || [])
            .filter(e => validTransferTypes.includes(e.transferType))
            .flatMap(e => {

                const commonFields = {
                    date: e.transferDate,
                    amount: e.paymentDetail?.amount ?? 0,
                    paymentDetail: e.paymentDetail
                };

                if (e.transferType === 'Bank To Bank') {
                    return [
                        {
                            ...commonFields,
                            _id: e._id,
                            status: e.transferType,
                            category: 'Payment Out',
                            ref: '',
                            bankHolderName: getAccountHolderName(e?.company?.bankAccounts, e.paymentDetail?.from?.accountNumber) ?? getAccountHolderName(e?.company?.bankAccounts,e.paymentDetails?.from?.accountNumber),
                            bankName: getBankName(e?.company?.bankAccounts,e.paymentDetail?.from?.accountNumber) ?? getBankName(e?.company?.bankAccounts,e.paymentDetails?.from?.accountNumber),
                            detail: `${e.paymentDetail?.from?.bankName}(${e.paymentDetail?.from?.accountHolderName}) to ${e.paymentDetail?.to?.bankName}(${e.paymentDetail?.to?.accountHolderName})`,
                        },
                        {
                            ...commonFields,
                            _id: e._id,
                            status: e.transferType,
                            category: 'Payment In',
                            ref: '',
                            bankHolderName: getAccountHolderName(e?.company?.bankAccounts,e.paymentDetail?.to?.accountNumber) ?? getAccountHolderName(e?.company?.bankAccounts,e.paymentDetails?.to?.accountNumber),
                            bankName: getBankName(e?.company?.bankAccounts,e.paymentDetail?.to?.accountNumber) ?? getBankName(e?.company?.bankAccounts,e.paymentDetails?.to?.accountNumber),
                            detail: `${e.paymentDetail?.from?.bankName}(${e.paymentDetail?.from?.accountHolderName}) to ${e.paymentDetail?.to?.bankName}(${e.paymentDetail?.to?.accountHolderName})`,
                        }
                    ];
                }

                const isPaymentIn =
                    (e.transferType === 'Adjust Bank Balance' && e.paymentDetail?.adjustmentType === 'Increase balance') ||
                    e.transferType === 'Cash To Bank';

                if (isPaymentIn) {
                    return {
                        ...commonFields,
                        _id: e._id,
                        status: e.transferType,
                        category: 'Payment In',
                        ref: '',
                        bankName: (e.transferType === 'Cash To Bank')
                            ? getBankName(e?.company?.bankAccounts,e.paymentDetail?.to?.accountNumber) ?? getBankName(e?.company?.bankAccounts,e.paymentDetails?.to?.accountNumber)
                            : getBankName(e?.company?.bankAccounts,e.paymentDetail?.from?.accountNumber) ?? getBankName(e?.company?.bankAccounts,e.paymentDetails?.from?.accountNumber),
                        bankHolderName: (e.transferType === 'Cash To Bank')
                            ? getAccountHolderName(e?.company?.bankAccounts,e.paymentDetail?.to?.accountNumber)
                            : getAccountHolderName(e?.company?.bankAccounts,e.paymentDetail?.from?.accountNumber),
                        detail: (e.transferType === 'Cash To Bank')
                            ? `Cash deposit to ${e.paymentDetail?.to?.bankName}(${e.paymentDetail?.to?.accountHolderName})`
                            : `Add adjustment ${e.paymentDetail?.from?.bankName}(${e.paymentDetail?.from?.accountHolderName})`,
                    };
                } else {
                    return {
                        ...commonFields,
                        _id: e._id,
                        status: e.transferType,
                        category: 'Payment Out',
                        ref: '',
                        bankName: getBankName(e?.company?.bankAccounts,e.paymentDetail?.from?.accountNumber) ?? getBankName(e.paymentDetails?.from?.accountNumber),
                        bankHolderName: getAccountHolderName(e?.company?.bankAccounts,e.paymentDetail?.from?.accountNumber) ?? getAccountHolderName(e.paymentDetails?.from?.accountNumber),
                        detail: (e.transferType === 'Bank To Cash')
                            ? `${e.paymentDetail?.from?.bankName}(${e.paymentDetail?.from?.accountHolderName}) To Cash Withdrawal`
                            : `Reduce adjustment ${e.paymentDetail?.from?.bankName}(${e.paymentDetail?.from?.accountHolderName})`,
                    };
                }
            });


        const transactions = results.flatMap((data, index) =>
            (Array.isArray(data) ? data : []).map(entry => ({
                category: models[index]?.categoryField ? entry[models[index].categoryField] : (models[index]?.category ?? 'Unknown'),
                ref: entry?.otherNumber ??
                    entry?.loanNo ??
                    entry?.loan?.loanNo ??
                    entry?.otherLoan?.otherNumber ??
                    entry?.description ??
                    entry?.category ??
                    '',
                company: entry?.company ?? entry?.loan?.company ?? entry?.otherLoan?.company ?? {},
                detail: `${entry?.customer?.firstName ??
                entry?.party?.name ??
                entry?.loan?.customer?.firstName ??
                entry?.otherName ??
                entry?.otherLoan?.otherName ??
                entry?.expenseType ??
                entry?.chargeType ??
                entry?.incomeType} ${(entry?.customer?.lastName ?? entry?.loan?.customer?.lastName) || ''}`,
                status: models[index]?.type,
                date: entry[models[index]?.dateField] ??
                    entry?.otherLoan?.date ??
                    null,
                bankName:
                    getBankName(entry?.company?.bankAccounts, entry?.paymentDetail?.bankDetails?.accountNumber, entry?.paymentDetails?.bankDetails?.accountHolderName) ??
                    getBankName(entry?.company?.bankAccounts, entry?.paymentDetails?.bankDetails?.accountNumber, entry?.paymentDetail?.bankDetails?.accountHolderName) ??
                    getBankName(entry?.company?.bankAccounts, entry?.bankDetails?.accountNumber, entry?.bankDetails?.accountHolderName) ??
                    getBankName(entry?.company?.bankAccounts, entry?.paymentDetail?.accountNumber, entry?.paymentDetail?.accountHolderName) ??
                    getBankName(entry?.company?.bankAccounts, entry?.paymentDetails?.accountNumber, entry?.paymentDetails?.accountHolderName) ??
                    getBankName(entry?.company?.bankAccounts, entry?.companyBankDetail?.account?.accountNumber, entry?.companyBankDetail?.account?.accountHolderName) ??
                    getBankName(entry?.company?.bankAccounts, entry?.bankDetails?.account?.accountNumber, entry?.bankDetails?.account?.accountHolderName) ??
                    getBankName(entry?.company?.bankAccounts, entry?.paymentDetail?.account?.accountNumber, entry?.paymentDetail?.account?.accountHolderName) ??
                    getBankName(entry?.company?.bankAccounts, entry?.paymentDetails?.account?.accountNumber, entry?.paymentDetails?.account?.accountHolderName) ??

                    getBankName(entry?.loan?.company?.bankAccounts, entry?.paymentDetail?.bankDetails?.accountNumber, entry?.paymentDetails?.bankDetails?.accountHolderName) ??
                    getBankName(entry?.loan?.company?.bankAccounts, entry?.paymentDetails?.bankDetails?.accountNumber, entry?.paymentDetail?.bankDetails?.accountHolderName) ??
                    getBankName(entry?.loan?.company?.bankAccounts, entry?.companyBankDetail?.account?.accountNumber, entry?.companyBankDetail?.account?.accountHolderName) ??
                    getBankName(entry?.loan?.company?.bankAccounts, entry?.bankDetails?.accountNumber, entry?.bankDetails?.accountHolderName) ??
                    getBankName(entry?.loan?.company?.bankAccounts, entry?.paymentDetail?.accountNumber, entry?.paymentDetail?.accountHolderName) ??
                    getBankName(entry?.loan?.company?.bankAccounts, entry?.paymentDetails?.accountNumber, entry?.paymentDetails?.accountHolderName) ??
                    getBankName(entry?.loan?.company?.bankAccounts, entry?.bankDetails?.account?.accountNumber, entry?.bankDetails?.account?.accountHolderName) ??
                    getBankName(entry?.loan?.company?.bankAccounts, entry?.paymentDetail?.account?.accountNumber, entry?.paymentDetail?.account?.accountHolderName) ??
                    getBankName(entry?.loan?.company?.bankAccounts, entry?.paymentDetails?.account?.accountNumber, entry?.paymentDetails?.account?.accountHolderName) ??

                    getBankName(entry?.otherLoan?.company?.bankAccounts, entry?.paymentDetail?.bankDetails?.accountNumber, entry?.paymentDetails?.bankDetails?.accountHolderName) ??
                    getBankName(entry?.otherLoan?.company?.bankAccounts, entry?.paymentDetails?.bankDetails?.accountNumber, entry?.paymentDetail?.bankDetails?.accountHolderName) ??
                    getBankName(entry?.otherLoan?.company?.bankAccounts, entry?.companyBankDetail?.account?.accountNumber, entry?.companyBankDetail?.account?.accountHolderName) ??
                    getBankName(entry?.otherLoan?.company?.bankAccounts, entry?.bankDetails?.accountNumber, entry?.bankDetails?.accountHolderName) ??
                    getBankName(entry?.otherLoan?.company?.bankAccounts, entry?.paymentDetail?.accountNumber, entry?.paymentDetail?.accountHolderName) ??
                    getBankName(entry?.otherLoan?.company?.bankAccounts, entry?.paymentDetails?.accountNumber, entry?.paymentDetails?.accountHolderName) ??
                    getBankName(entry?.otherLoan?.company?.bankAccounts, entry?.bankDetails?.account?.accountNumber, entry?.bankDetails?.account?.accountHolderName) ??
                    getBankName(entry?.otherLoan?.company?.bankAccounts, entry?.paymentDetail?.account?.accountNumber, entry?.paymentDetail?.account?.accountHolderName) ??
                    getBankName(entry?.otherLoan?.company?.bankAccounts, entry?.paymentDetails?.account?.accountNumber, entry?.paymentDetails?.account?.accountHolderName) ??
                    // getBankName(entry?.otherLoan?.company?.bankAccounts, entry?.paymentDetail?.accountNumber, entry?.paymentDetail?.accountHolderName) ??
                    // getBankName(entry?.otherLoan?.company?.bankAccounts, entry?.bankDetails?.account?.accountNumber, entry?.bankDetails?.account?.accountHolderName) ??
                    // getBankName(entry?.loan?.company?.bankAccounts, entry?.companyBankDetail?.account?.accountNumber, entry?.companyBankDetail?.account?.accountHolderName) ??


                    //
                    // getBankName(entry?.company?.bankAccounts, entry?.companyBankDetail?.account?.accountNumber, entry?.companyBankDetail?.account?.accountHolderName) ??
                    // getBankName(entry?.company?.bankAccounts, entry?.paymentDetail?.account?.accountNumber, entry?.paymentDetail?.account?.accountHolderName) ??
                    // getBankName(entry?.company?.bankAccounts, entry?.paymentDetails?.account?.accountNumber, entry?.paymentDetails?.account?.accountHolderName) ??
                    // getBankName(entry?.company?.bankAccounts, entry?.paymentDetails?.chargeAccount?.accountNumber, entry?.paymentDetails?.chargeAccount?.accountHolderName) ??
                    // getBankName(entry?.company?.bankAccounts, entry?.paymentDetail?.accountNumber, entry?.paymentDetail?.accountHolderName) ??
                    // getBankName(entry?.company?.bankAccounts, entry?.bankDetails?.accountNumber, entry?.bankDetails?.accountHolderName ) ??
                    // getBankName(entry?.company?.bankAccounts , entry?.paymentDetail?.bankDetails?.accountNumber, entry?.paymentDetail?.bankDetails?.accountHolderName) ??
                    null,
                bankHolderName:
                    getAccountHolderName(entry?.company?.bankAccounts, entry?.paymentDetail?.bankDetails?.accountNumber, entry?.paymentDetail?.bankDetails?.accountHolderName) ??
                    getAccountHolderName(entry?.company?.bankAccounts, entry?.paymentDetails?.bankDetails?.accountNumber, entry?.paymentDetails?.bankDetails?.accountHolderName) ??
                    getAccountHolderName(entry?.company?.bankAccounts, entry?.companyBankDetail?.account?.accountNumber, entry?.companyBankDetail?.account?.bankName) ??
                    getAccountHolderName(entry?.company?.bankAccounts, entry?.bankDetails?.accountNumber, entry?.bankDetails?.bankName) ??
                    getAccountHolderName(entry?.company?.bankAccounts, entry?.paymentDetail?.account?.accountNumber, entry?.paymentDetail?.account?.bankName) ??
                    getAccountHolderName(entry?.company?.bankAccounts, entry?.paymentDetail?.accountNumber, entry?.paymentDetail?.bankName) ??
                    getAccountHolderName(entry?.company?.bankAccounts, entry?.paymentDetails?.account?.accountNumber, entry?.paymentDetails?.account?.bankName) ??
                    getAccountHolderName(entry?.company?.bankAccounts, entry?.paymentDetails?.accountNumber, entry?.paymentDetails?.bankName) ??

                    getAccountHolderName(entry?.loan?.company?.bankAccounts, entry?.paymentDetail?.bankDetails?.accountNumber, entry?.paymentDetail?.bankDetails?.accountHolderName) ??
                    getAccountHolderName(entry?.loan?.company?.bankAccounts, entry?.paymentDetails?.bankDetails?.accountNumber, entry?.paymentDetails?.bankDetails?.accountHolderName) ??
                    getAccountHolderName(entry?.loan?.company?.bankAccounts, entry?.companyBankDetail?.account?.accountNumber, entry?.companyBankDetail?.account?.bankName) ??
                    getAccountHolderName(entry?.loan?.company?.bankAccounts, entry?.bankDetails?.account?.accountNumber, entry?.bankDetails?.account?.bankName) ??
                    getAccountHolderName(entry?.loan?.company?.bankAccounts, entry?.paymentDetail?.account?.accountNumber, entry?.paymentDetail?.account?.bankName) ??
                    getAccountHolderName(entry?.loan?.company?.bankAccounts, entry?.paymentDetail?.accountNumber, entry?.paymentDetail?.bankName) ??
                    getAccountHolderName(entry?.loan?.company?.bankAccounts, entry?.paymentDetails?.account?.accountNumber, entry?.paymentDetails?.account?.bankName) ??
                    getAccountHolderName(entry?.loan?.company?.bankAccounts, entry?.paymentDetails?.accountNumber, entry?.paymentDetails?.bankName) ??

                    getAccountHolderName(entry?.otherLoan?.company?.bankAccounts, entry?.companyBankDetail?.account?.accountNumber, entry?.companyBankDetail?.account?.bankName) ??
                    getAccountHolderName(entry?.otherLoan?.company?.bankAccounts, entry?.bankDetails?.accountNumber, entry?.bankDetails?.bankName) ??
                    getAccountHolderName(entry?.otherLoan?.company?.bankAccounts, entry?.paymentDetail?.account?.accountNumber, entry?.paymentDetail?.account?.bankName) ??
                    getAccountHolderName(entry?.otherLoan?.company?.bankAccounts, entry?.paymentDetail?.accountNumber, entry?.paymentDetail?.bankName) ??
                    getAccountHolderName(entry?.otherLoan?.company?.bankAccounts, entry?.paymentDetails?.account?.accountNumber, entry?.paymentDetails?.account?.bankName) ??
                    getAccountHolderName(entry?.otherLoan?.company?.bankAccounts, entry?.paymentDetails?.accountNumber, entry?.paymentDetails?.bankName) ??
                    getAccountHolderName(entry?.otherLoan?.company?.bankAccounts, entry?.paymentDetail?.bankDetails?.accountNumber, entry?.paymentDetail?.bankDetails?.accountHolderName) ??
                    getAccountHolderName(entry?.otherLoan?.company?.bankAccounts, entry?.paymentDetails?.bankDetails?.accountNumber, entry?.paymentDetails?.bankDetails?.accountHolderName) ??


                    // getAccountHolderName(entry?.loan?.company?.bankAccounts, entry?.paymentDetail?.accountNumber, entry?.paymentDetail?.bankName) ??
                    // getAccountHolderName(entry?.loan?.company?.bankAccounts, entry?.paymentDetail?.account?.accountNumber, entry?.paymentDetail?.account?.bankName) ??
                    // getAccountHolderName(entry?.otherLoan?.company?.bankAccounts, entry?.paymentDetail?.accountNumber, entry?.paymentDetail?.bankName) ??
                    // getAccountHolderName(entry?.otherLoan?.company?.bankAccounts, entry?.bankDetails?.account?.accountNumber, entry?.bankDetails?.account?.bankName) ??
                    // entry?.companyBankDetail?.account?.accountHolderName ??
                    // entry?.paymentDetail?.account?.accountHolderName ??
                    // entry?.paymentDetail?.accountHolderName ??
                    // entry?.bankDetails?.accountHolderName ??
                    null,
                amount: models[index]?.type === "Other Loan Interest"
                    ? Number((entry?.paymentDetail?.bankAmount ?? 0) - (entry?.charge ?? 0))
                    : Number(entry?.bankAmount ??
                        entry?.bankDetails?.bankAmount ??
                        entry?.paymentDetail?.bankAmount ??
                        entry?.paymentDetails?.bankAmount ??
                        entry?.paymentDetails?.chargeBankAmount ??
                        entry?.bankDetails?.account?.bankAmount ?? 0),
                paymentDetail: entry?.paymentDetail ??
                    entry?.paymentDetails ??
                    entry?.bankDetails ??
                    entry?.paymentDetail?.bankDetails ?? {},
                allCategory: entry?.category ?? "",
            }))
        ).filter(t => t?.amount !== 0);

        // console.log(transactions.filter((e) => e.status === 'Other Loan Issued' && e.bankHolderName === 'CHETAN S'));

        const sumByBank = (bankName, type) =>
            [...transactions, ...transfers]
                .filter(txn => txn.category === type && txn.bankName === bankName)
                .reduce((sum, txn) => sum + txn.amount, 0);

        const company = await CompanyModel.findById(companyId).lean();

        const bankBalances = (company?.bankAccounts || []).map(bank => ({
            ...bank,
            balance: sumByBank(bank?.bankName, 'Payment In') - sumByBank(bank?.bankName, 'Payment Out')
        }));

        const sortedTransactions = [...transactions, ...transfers].sort((a, b) => new Date(b.date) - new Date(a.date));

        res.status(200).json({
            status: 200,
            message: "All transactions fetched successfully",
            data: {
                transactions: sortedTransactions,
                bankBalances
            }
        });

    } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({status: 500, message: "Internal server error"});
    }
}

module.exports = {allTransactions, allBankTransactions}