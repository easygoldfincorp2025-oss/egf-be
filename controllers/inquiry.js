const InquiryModel = require("../models/inquiry")
const readXlsxFile = require('read-excel-file/node');
const { parse, isValid } = require('date-fns');


async function addInquiry(req, res) {
    const {companyId} = req.params;
    const {branch, assignTo} = req.query;
    const {email, contact} = req.body
    try {
        // const isInquiryExist = await InquiryModel.exists({
        //     company: companyId,
        //     branch,
        //     $or: [{email}, {contact}],
        //     deleted_at: null
        // });
        //
        // if (isInquiryExist) {
        //     return res.status(400).json({status: 400, message: "Inquiry already exists"});
        // }

        const inquiry = await InquiryModel.create({
            ...req.body,
            company: companyId,
            branch,
            assignTo,
        });

        return res.status(200).json({status: 200, data: inquiry, message: "Inquiry created successfully"});
    } catch (err) {
        console.error("Error creating inquiry:", err.message);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}

async function addInquiryWithoutResponse(inquiryData, assignTo, branch, companyId) {
    const { email, contact } = inquiryData;

    try {
        // const isInquiryExist = await InquiryModel.exists({
        //     company: companyId,
        //     branch,
        //     $or: [{ email }, { contact }],
        //     deleted_at: null
        // });
        //
        // if (isInquiryExist) {
        //     return { success: false, message: "Inquiry already exists" };
        // }

        const inquiry = await InquiryModel.create({
            ...inquiryData,
            company: companyId,
            branch,
            assignTo,
        });

        return { success: true, data: inquiry, message: "Inquiry created successfully" };
    } catch (error) {
        console.error("Error creating inquiry:", error.message);
        return { success: false, message: "Internal server error", error: error.message };
    }
}


async function addBulkInquiries(req, res) {
    try {
        const {companyId} = req.params
        const {assignTo, branch} = req.query
        const fileBuffer = req.file.buffer;
        const rows = await readXlsxFile(fileBuffer);

        const header = rows.shift();

        let successCount = 0;
        let failureCount = 0;
        const errors = [];

        for (const row of rows) {
            try {
                const inquiryData = mapRowToInquiry(row, header);

                const result = await addInquiryWithoutResponse(inquiryData, assignTo, branch, companyId);

                if (result.success) {
                    successCount++;
                } else {
                    failureCount++;
                    errors.push({ row, message: result.message });
                }
            } catch (error) {
                failureCount++;
                errors.push({ row, message: error.message });
            }
        }

        res.status(200).json({
            successCount,
            failureCount,
            message: `${successCount} inquiries created successfully, ${failureCount} failed.`,
            errors
        });
    } catch (error) {
        // Handle errors that occur outside the loop
        res.status(500).json({ error: error.message });
    }
}


function mapRowToInquiry(row, header) {
    const inquiryData = {};
    header.forEach((col, index) => {
        const value = row[index];
        if (col === 'contact' || col === 'zipcode') {
            inquiryData[col] = value?.toString() || ""; // Convert to string
        } else if (col === 'date' || col === 'recallingDate') {
            if (value instanceof Date) {
                // If already a Date object, use it directly
                inquiryData[col] = value;
            } else if (typeof value === 'string' && value.trim()) {
                // If string, parse it with the expected format
                const parsedDate = parse(value, 'dd-MM-yyyy', new Date());
                inquiryData[col] = isValid(parsedDate) ? parsedDate : null; // Ensure valid date
            } else {
                // Handle empty or invalid date
                inquiryData[col] = null;
            }
        } else {
            // For non-date columns, ensure null or undefined values are replaced with an empty string
            inquiryData[col] = value == null ? "" : value;
        }
    });
    return inquiryData;
}




async function getAllInquiries(req, res) {
    const {companyId} = req.params;
    const {branch, assignTo} = req.query;

    try {
        const query = {
            company: companyId,
            deleted_at: null
        };

        if (branch) {
            query.branch = branch;
        }

        if (assignTo) {
            query.assignTo = assignTo
        }

        const inquiries = await InquiryModel.find(query)
            .populate("company")
            .populate("branch")
            .populate({path: 'assignTo', select: "_id user", populate: {path: "user", select: "firstName middleName lastName contact email"}})

        return res.status(200).json({status: 200, data: inquiries});
    } catch (err) {
        console.error("Error fetching inquiries:", err.message);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}


async function updateInquiry(req, res) {
    const {companyId, inquiryId} = req.params;
    const {branch, assignTo} = req.query;
    const {email, contact} = req.body;

    try {
        // const isInquiryExist = await InquiryModel.exists({
        //     company: companyId,
        //     branch, assignTo,
        //     $or: [{email}, {contact}],
        //     _id: {$ne: inquiryId},
        //     deleted_at: null
        // });
        //
        // if (isInquiryExist) {
        //     return res.status(400).json({status: 400, message: "Inquiry already exists"});
        // }

        const updatedInquiry = await InquiryModel.findByIdAndUpdate(inquiryId, req.body, {new: true});

        if (!updatedInquiry) {
            return res.status(404).json({status: 404, message: "Inquiry not found"});
        }

        return res.status(200).json({status: 200, data: updatedInquiry, message: "Inquiry updated successfully"});
    } catch (err) {
        console.error("Error updating inquiry:", err.message);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}


async function getSingleInquiry(req, res) {
    const {inquiryId} = req.params;

    try {
        const inquiry = await InquiryModel.findById(inquiryId)
            .populate("company")
            .populate("branch");

        if (!inquiry) {
            return res.status(404).json({status: 404, message: "Inquiry not found"});
        }

        return res.status(200).json({status: 200, data: inquiry});
    } catch (err) {
        console.error("Error fetching inquiry:", err.message);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}


async function deleteMultipleInquiries(req, res) {
    const {ids} = req.body;

    try {
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({status: 400, message: "No inquiry IDs provided"});
        }

        const result = await InquiryModel.updateMany(
            {_id: {$in: ids}},
            {$set: {deleted_at: new Date()}}
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({status: 404, message: "No inquiries found for the provided IDs"});
        }

        return res.status(200).json({status: 200, message: "Inquiries deleted successfully"});
    } catch (err) {
        console.error("Error deleting inquiries:", err.message);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}


module.exports = {addInquiry, getAllInquiries, updateInquiry, getSingleInquiry, deleteMultipleInquiries, addBulkInquiries}