const moment = require('moment');
const CustomerModel = require("../models/customer")
const IssuedLoanModel = require("../models/issued-loan")
const OtherIssuedLoanModel = require("../models/other-issued-loan")
const InterestModel = require("../models/interest")
const UchakInterestModel = require("../models/uchak-interest-payment")
const ConfigModel = require("../models/config");
const axios = require("axios");
const FormData = require("form-data");
const PartPaymentModel = require("../models/loan-part-payment");
const LoanPartReleaseModel = require("../models/part-release");
const PenaltyModel = require("../models/penalty");

async function sendBirthdayNotification() {
    try {
        const today = new Date();
        const monthDay = today.toISOString().slice(5, 10); // "MM-DD"

        const customers = await CustomerModel.find({
            dob: {$exists: true, $ne: null},
            $expr: {
                $eq: [
                    {
                        $cond: {
                            if: {$eq: [{$type: "$dob"}, "string"]},
                            then: {$substrBytes: ["$dob", 5, 5]}, // string → extract MM-DD
                            else: {$dateToString: {format: "%m-%d", date: "$dob"}} // date → extract MM-DD
                        }
                    },
                    monthDay
                ]
            }
        }).select('_id company firstName middleName lastName contact').populate('company', 'name').lean();

        customers.forEach(async (customer) => {
            await sendMessage({
                contact: customer.contact,
                company: customer.company._id,
                type: 'birthday_wish',
                firstName: customer.firstName,
                middleName: customer.middleName,
                lastName: customer.lastName,
                companyName: customer.company.name,
                companyContact: customer.company.contact,
            })
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({message: "Error sending birthday notifications"});
    }
}

async function updateOverdueOtherLoans() {
    const today = new Date();
    const sevenDaysAfterToday = new Date();
    sevenDaysAfterToday.setDate(today.getDate() + 7);

    try {
        await OtherIssuedLoanModel.bulkWrite([
            {
                // Set status to 'Overdue' if renewalDate is within next 7 days (inclusive)
                updateMany: {
                    filter: {
                        deleted_at: null,
                        renewalDate: {
                            $lte: sevenDaysAfterToday
                        },
                        status: {$nin: ['Closed']}
                    },
                    update: {$set: {status: 'Overdue'}}
                }
            },
            // {
            //     // Set status to 'Regular' if it's not within the 7-day overdue window
            //     updateMany: {
            //         filter: {
            //             deleted_at: null,
            //             $or: [
            //                 { renewalDate: { $gt: today } }
            //             ],
            //             status: { $nin: ['Closed'] }
            //         },
            //         update: { $set: { status: 'Regular' } }
            //     }
            // }
        ]);
    } catch (error) {
        console.error(error);
    }
}


async function updateOverdueLoans() {
    try {
        const today = new Date();

        await IssuedLoanModel.bulkWrite([
            {
                updateMany: {
                    filter: {
                        deleted_at: null,
                        nextInstallmentDate: {$lt: today},
                        status: {$nin: ["Closed", "Issued"]}
                    },
                    update: {$set: {status: 'Overdue'}}
                }
            },
            {
                updateMany: {
                    filter: {
                        deleted_at: null,
                        nextInstallmentDate: {$gte: today},
                        lastInstallmentDate: {$ne: null},
                        status: {$nin: ['Closed', 'Issued']}
                    },
                    update: {$set: {status: 'Regular'}}
                }
            }
        ]);


    } catch (error) {
        console.error(error);
    }
}


async function interestReminders() {
    try {
        const today = moment().startOf('day');
        const endOfMonthDate = moment().endOf('month').startOf('day');
        const fromDate = moment().add(3, 'days').startOf('day');

        const loans = await IssuedLoanModel.find({
            nextInstallmentDate: {$lt: fromDate.toDate()},
            status: {$nin: ["Closed", 'Issued']},
            deleted_at: null,
        }).populate([
            {path: "customer", populate: "branch"},
            {path: "company"},
            {path: "scheme"}
        ]);

        const reminders = loans.map(async (loan) => {
            const [interests] = await Promise.all([
                InterestModel.find({loan: loan._id}).sort({createdAt: -1}),
            ]);

            const lastInterest = interests.length > 0 ? interests[0]?.createdAt : loan.issueDate;

            const uchakInterestData = await UchakInterestModel.aggregate([
                {$match: {loan: String(loan._id), date: {$gte: lastInterest}}},
                {$group: {_id: null, totalInterest: {$sum: "$amountPaid"}}}
            ]);

            const uchakInterest = uchakInterestData.length > 0 ? uchakInterestData[0].totalInterest : 0;

            const lastInstallmentDate = loan.lastInstallmentDate ? moment(loan.lastInstallmentDate) : moment(loan.issueDate).startOf('day');
            const daysDiff = endOfMonthDate.diff(lastInstallmentDate, 'days');
            const penaltyDayDiff = (loan.nextInstallmentDate < today) ? endOfMonthDate.diff(moment(interests.length ? loan.nextInstallmentDate : loan.issueDate), 'days') : 0;

            const interestRate = loan.scheme?.interestRate ?? 0;
            const interestAmount = ((loan.interestLoanAmount * (interestRate / 100)) * 12 * daysDiff) / 365;
            const oldCrDr = interests.length ? interests[0].cr_dr ?? 0 : 0;

            let pendingInterest = interestAmount - uchakInterest + oldCrDr;
            let penaltyAmount = 0;

            const penaltyData = await PenaltyModel.findOne({
                company: loan.company._id,
                afterDueDateFromDate: {$lte: penaltyDayDiff},
                afterDueDateToDate: {$gte: penaltyDayDiff},
            }).select('penaltyInterest');

            if (penaltyData) {
                const penaltyInterestRate = penaltyData.penaltyInterest;
                penaltyAmount = ((loan.interestLoanAmount * (penaltyInterestRate / 100)) * 12 * daysDiff) / 365;
            }

            pendingInterest += penaltyAmount;

            const payload = {
                type: 'reminder',
                firstName: loan.customer.firstName,
                middleName: loan.customer.middleName,
                lastName: loan.customer.lastName,
                contact: loan.customer.contact,
                loanNumber: loan.loanNo,
                loanAmount: Number(loan.loanAmount).toFixed(2),
                interestAmount: Number(pendingInterest).toFixed(2),
                nextInstallmentDate: moment(endOfMonthDate, 'DD-MM-YYYY').format(),
                branchContact: loan.customer.branch.contact,
                companyContact: loan.company.contact,
                companyEmail: loan.company.email,
                companyName: loan.company.name,
            };
            await sendMessage(payload);
            console.log("message sent.")
        });

        await Promise.all(reminders);
        console.log("Reminders sent successfully.");

    } catch (error) {
        console.error("Error sending interest reminders:", error);
    }
}

async function sendWhatsAppMessage(formData) {
    try {
        await axios.post(process.env.WHATSAPP_API_URL, formData);
    } catch (error) {
        console.log(error);
        throw error
    }
}

async function sendWhatsAppNotification(req, res) {
    try {
        const payload = req.body
        const file = req.file || null
        await sendMessage(payload, file)

        res.status(200).json({
            success: true,
            message: "WhatsApp notification sent successfully",
        });
    } catch (error) {
        console.error("Error sending WhatsApp notification:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to send WhatsApp notification",
            error: error.response ? error.response.data : error.message,
        });
    }
}

async function sendMessage(messagePayload, file = null) {
    try {
        const {type, contact, company, ...payload} = messagePayload;
        const scenarioFunction = scenarios[type];

        if (!scenarioFunction) {
            return {
                success: false,
                message: "Invalid notification type",
            };
        }

        // Fetch WhatsApp configuration
        const config = await ConfigModel.findOne({company}).select("whatsappConfig");
        let contacts = []

        if (type === "office_holiday_notice") {
            const filter = {
                company,
                deleted_at: null,
            };

            const customers = await CustomerModel.find(filter);
            const updatedCustomers = await Promise.all(customers.map(async (customer) => {
                const hasActiveLoan = await IssuedLoanModel.exists({
                    customer: customer._id,
                    status: {$ne: "Closed"},
                    deleted_at: null,
                });

                customer = customer.toObject();
                customer.isLoan = !!hasActiveLoan;
                return customer;
            }));
            const filteredCustomers = updatedCustomers.filter(customer => {
                if (messagePayload.isLoan === "all") return true;
                if (messagePayload.isLoan === "true") return customer.isLoan === true;
                if (messagePayload.isLoan === "false") return customer.isLoan === false;
            });

            const customerContacts = filteredCustomers.map(c => c.contact);

            contacts = [
                ...customerContacts,
                config?.whatsappConfig?.contact1,
                config?.whatsappConfig?.contact2
            ].filter(Boolean);

        } else {
            contacts = [
                contact,
                config?.whatsappConfig?.contact1,
                config?.whatsappConfig?.contact2
            ].filter(Boolean);
        }

        if (contacts.length === 0) {
            console.warn("No valid contacts found.");
            return {
                success: false,
                message: "No valid contacts found",
            };
        }

        const sendRequest = async (contact) => {
            try {

                const formData = new FormData();
                formData.append("authToken", process.env.WHATSAPP_API_AUTH_TOKEN);
                formData.append("name", [payload.firstName, payload.middleName, payload.lastName].filter(Boolean).join(" "));
                formData.append("sendto", `91${contact}`);
                formData.append("originWebsite", process.env.WHATSAPP_API_ORIGIN_WEBSITE);
                formData.append("templateName", type);
                formData.append("language", process.env.WHATSAPP_API_TEMPLATE_LANGUAGE);

                // Handling file attachments
                if (file && file.buffer) {
                    formData.append("myfile", file.buffer, {
                        filename: file.originalname,
                        contentType: file.mimetype,
                    });
                    console.log(`File attached: ${file.originalname}`);
                }

                // Adding template variables
                const scenarioData = scenarioFunction(payload, file);

                scenarioData.forEach((value, index) => {
                    formData.append(`data[${index}]`, value != null ? String(value) : "");
                });

                // Send request to WhatsApp API
                const response = await axios({
                    method: "post",
                    maxBodyLength: Infinity,
                    url: "https://app.11za.in/apis/template/sendTemplate",
                    headers: {...formData.getHeaders()},
                    data: formData,
                });

                return response.data;
            } catch (error) {
                console.error(`Error sending message to ${contact}:`, error.response?.data || error.message);
                return {success: false, error: error.response?.data || error.message};
            }
        };
        const uniqueContacts = [...new Set(contacts)];

        const results = await Promise.all(uniqueContacts.map(sendRequest));
        return {success: true, results};
    } catch (error) {
        console.error("Unexpected error in sendMessage:", error);
        return {success: false, message: "Internal server error", error: error.message};
    }
}

const scenarios = {
    loan_details: (payload, file) => [
        `${payload.firstName} ${payload.middleName} ${payload.lastName}`,
        payload.loanNo,
        payload.loanAmount,
        payload.interestRate,
        payload.consultingCharge,
        moment(payload.issueDate).format("DD/MM/YYYY"),
        moment(payload.nextInstallmentDate).format("DD/MM/YYYY"),
        payload.branchContact,
        payload.companyContact,
        payload.companyEmail,
        payload.companyName,
        payload.companyName,
    ],
    sanction_letter_11: (payload, file) => [],
    loan_issue: (payload, file) => [
        `${payload.firstName} ${payload.middleName} ${payload.lastName}`,
        payload.loanNo,
        payload.loanAmount,
        payload.interestRate,
        payload.consultingCharge,
        moment(payload.issueDate).format("DD/MM/YYYY"),
        moment(payload.nextInstallmentDate).format("DD/MM/YYYY"),
        payload.companyContact,
        payload.branchContact,
        payload.companyEmail,
        payload.companyName,
        payload.companyName,
    ],
    reminder: (payload) => [
        `${payload.firstName} ${payload.middleName} ${payload.lastName}`,
        payload.loanNumber,
        payload.loanNumber,
        payload.loanAmount,
        payload.interestAmount,
        moment(payload.nextInstallmentDate).format("DD/MM/YYYY"),
        payload.branchContact,
        payload.companyContact,
        payload.companyEmail,
        payload.companyName,
    ],
    interest_payment: (payload, file) => [
        `${payload.firstName} ${payload.middleName} ${payload.lastName}`,
        payload.loanNumber,
        payload.interestAmount,
        moment().format("DD/MM/YYYY"),
        moment(payload.nextInstallmentDate).format("DD/MM/YYYY"),
        payload.branchContact,
        payload.companyContact,
        payload.companyEmail,
        payload.companyName,
        payload.companyName,
    ],
    uchak_interest: (payload, file) => [
        `${payload.firstName} ${payload.middleName} ${payload.lastName}`,
        payload.loanNumber,
        payload.amountPaid,
        moment().format("DD/MM/YYYY"),
        payload.branchContact,
        payload.companyContact,
        payload.companyEmail,
        payload.companyName,
        payload.companyName,
    ],
    part_release: (payload, file) => [
        `${payload.firstName} ${payload.middleName} ${payload.lastName}`,
        payload.loanNumber,
        payload.amountPaid,
        payload.interestLoanAmount,
        moment(payload.createdAt).format("DD/MM/YYYY"),
        moment(payload.nextInstallmentDate).format("DD/MM/YYYY"),
        payload.branchContact,
        payload.companyContact,
        payload.companyEmail,
        payload.companyName,
        payload.companyName,
    ],
    part_payment: (payload, file) => [
        `${payload.firstName} ${payload.middleName} ${payload.lastName}`,
        payload.loanNumber,
        payload.amountPaid,
        moment(payload.createdAt).format("DD/MM/YYYY"),
        payload.interestLoanAmount,
        moment(payload.nextInstallmentDate).format("DD/MM/YYYY"),
        payload.branchContact,
        payload.companyContact,
        payload.companyEmail,
        payload.companyName,
        payload.companyName,
    ],
    loan_close: (payload, file) => [
        `${payload.firstName} ${payload.middleName} ${payload.lastName}`,
        payload.loanNumber,
        payload.loanAmount,
        moment(payload.date).format("DD/MM/YYYY"),
        payload.closingCharge,
        payload.amountPaid,
        payload.branchContact,
        payload.companyContact,
        payload.companyEmail,
        payload.companyName,
        payload.companyName,
    ],
    birthday_wish: (payload, file) => [
        payload.firstName,
        payload.companyName,
        payload.companyName,
        payload.companyName,
        payload.companyContact,
        'www.easygoldfincorp.com',
        payload.companyName,
    ],
    birthday_wish: (payload, file) => [
        payload.firstName,
        payload.companyName,
        payload.companyName,
        payload.companyName,
        payload.companyContact,
        'www.easygoldfincorp.com',
        payload.companyName,
    ],
    payment_in_1: (payload, file) => [
        payload.party,
        payload.companyName,
        payload.amount,
        payload.remainingBalance,
    ],
    payment_out_1: (payload, file) => [
        payload.party,
        payload.companyName,
        payload.amount,
        payload.remainingBalance,
    ],
    payment_in_self: (payload, file) => [
        payload.amount,
        payload.party,
        payload.remainingBalance,
    ],
    payment_out_self: (payload, file) => [
        payload.amount,
        payload.party,
        payload.remainingBalance,
    ],
    office_holiday_notice: (payload, file) => [
        payload.occasion,
        moment(payload.startDate).format("DD/MM/YYYY"),
        moment(payload.endDate).format("DD/MM/YYYY"),
        payload.occasion,
        moment(payload.reopenDate).format("DD/MM/YYYY"),
        payload.message,
    ],
};


module.exports = {
    sendBirthdayNotification,
    updateOverdueLoans,
    updateOverdueOtherLoans,
    sendWhatsAppMessage,
    sendWhatsAppNotification,
    interestReminders
}
