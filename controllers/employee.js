const mongoose = require('mongoose');
const EmployeeModel = require("../models/employee");
const UserModel = require("../models/user");
const BranchModel = require("../models/branch");
const {uploadFile} = require("../helpers/avatar");
const path = require("path");
const ejs = require("ejs");
const {sendMail} = require("../helpers/sendmail");
const {uploadDir} = require("../constant");
const XLSX = require("xlsx");

async function createEmployee(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {companyId} = req.params;
        const {branch} = req.query
        const {
            firstName,
            middleName,
            lastName,
            email,
            contact,
            fatherContact,
            dob,
            role,
            drivingLicense,
            panCard,
            aadharCard,
            voterCard,
            remark,
            reportingTo,
            joiningDate,
            permanentAddress,
            temporaryAddress,
            bankDetails,
            status,
            isAadharVerified,
            otherDetails
        } = req.body;

        const avatar = req.file && req.file.buffer ? await uploadFile(req.file.buffer, uploadDir.EMPLOYEES, firstName+"_"+lastName) : null;

        const isEmployeeExist = await UserModel.exists({
            company: companyId,
            branch,
            email,
            contact,
            deleted_at: null,
        });

        if (isEmployeeExist) {
            await session.abortTransaction();
            await session.endSession();
            return res.status(400).json({status: 400, message: "Employee already exists."});
        }


        const user = new UserModel({
            company: companyId,
            role,
            branch,
            avatar_url: avatar,
            firstName,
            middleName,
            lastName,
            email,
            contact,
            fatherContact
        });

        await user.save({session});

        const employee = new EmployeeModel({
            company: companyId,
            user: user._id,
            drivingLicense,
            panCard,
            aadharCard,
            voterCard,
            dob,
            remark,
            reportingTo,
            joiningDate,
            status,
            permanentAddress,
            temporaryAddress,
            bankDetails,
            otherDetails,
            isAadharVerified
        });

        await employee.save({session});

        const templatePath = path.join(__dirname, '../views/welcomeUser.ejs');
        const logoPath = path.join(__dirname, '../public/images/22.png');

        const htmlContent = await ejs.renderFile(templatePath, {
            name: `${firstName} ${lastName}`,
        });

        const mailPayload = {
            subject: "Welcome to EGF! Easy Gold Finance system",
            logo: logoPath,
            email
        };

        // await sendMail(htmlContent, mailPayload);

        await session.commitTransaction();
        await session.endSession();

        return res.status(201).json({status: 201, message: "Employee created successfully", data: {id: employee._id}});

    } catch (err) {
        await session.abortTransaction();
        await session.endSession();
        console.error(err);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}

async function getAllEmployees(req, res) {
    const {companyId} = req.params;
    const {branch} = req.query;

    try {
        const query = {
            company: companyId,
            deleted_at: null
        };

        const employees = await EmployeeModel.find(query)
            .populate("company")
            .populate("user")
            .populate("reportingTo");

        const updatedEmployees = await Promise.all(employees.map(async (emp) => {
            if (emp && emp.user) {
                if (emp.user.branch) {
                    emp.user.branch = await BranchModel.findById(emp.user.branch);
                } else {
                    emp.user.branch = null;
                }
            }
            return emp;
        }));

        const filteredEmployees = branch
            ? updatedEmployees.filter(employee => employee.user && employee.user.branch?._id?.toString() === branch)
            : updatedEmployees;

        return res.status(200).json({status: 200, data: filteredEmployees});
    } catch (err) {
        console.error("Error fetching employees:", err.message);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}

async function updateEmployee(req, res) {
    const {employeeId, companyId} = req.params;
    const {branch} = req.query;
    const {
        firstName,
        middleName,
        lastName,
        email,
        contact,
        fatherContact,
        dob,
        role,
        drivingLicense,
        panCard,
        aadharCard,
        voterCard,
        remark,
        reportingTo,
        joiningDate,
        leaveDate,
        permanentAddress,
        temporaryAddress,
        bankDetails,
        status,
        isAadharVerified,
        otherDetails
    } = req.body;

    try {
        const isEmployeeExist = await EmployeeModel.exists({
            company: companyId,
            branch,
            deleted_at: null,
            email,
            contact,
            _id: {$ne: employeeId}
        });

        if (isEmployeeExist) {
            return res.status(400).json({status: 400, message: "Employee already exists."});
        }

        const updatedEmp = await EmployeeModel.findByIdAndUpdate(
            employeeId,
            {
                drivingLicense,
                panCard,
                aadharCard,
                voterCard,
                dob,
                remark,
                reportingTo,
                joiningDate,
                leaveDate,
                status,
                permanentAddress,
                temporaryAddress,
                bankDetails,
                otherDetails,
                isAadharVerified
            },
            {new: true}
        );

        if (!updatedEmp) {
            return res.status(404).json({status: 404, message: "Employee not found."});
        }

        await UserModel.findByIdAndUpdate(
            updatedEmp.user,
            {
                branch,
                role,
                firstName,
                middleName,
                lastName,
                email,
                contact,
                fatherContact
            },
            {new: true}
        );

        return res.status(200).json({status: 200, message: "Employee updated successfully"});
    } catch (err) {
        console.error("Error updating employee:", err.message);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}

async function getSingleEmployee(req, res) {
    const {employeeId} = req.params;

    try {
        const employee = await EmployeeModel.findById(employeeId)
            .populate("company")
            .populate({
                path: "user",
                populate: {
                    path: "branch"
                }
            })
            .populate("reportingTo");

        if (!employee) {
            return res.status(404).json({status: 404, message: "Employee not found"});
        }

        return res.status(200).json({status: 200, data: employee});
    } catch (err) {
        console.error("Error fetching employee:", err.message);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}

async function deleteMultipleEmployees(req, res) {
    try {
        const {ids} = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({status: 400, message: "Invalid employee IDs."});
        }

        await EmployeeModel.updateMany(
            {user: {$in: ids}},
            {$set: {deleted_at: new Date()}}
        );

        await UserModel.updateMany(
            {_id: {$in: ids}},
            {
                $set: {deleted_at: new Date()}
            })

        return res.status(200).json({status: 200, message: "Employees deleted successfully."});
    } catch (err) {
        console.error(err);
        return res.status(500).json({status: 500, message: "Internal server error"});
    }
}

async function employeeOtherDetail(req,res) {
    // Read the file
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    for (let row of jsonData) {
        // Example: Find document by unique field (say Name) and update
        const {AadharCard, ...otherDetails} = row
        await EmployeeModel.updateOne(
            { aadharCard: row.AadharCard },  // find condition (you can change it)
            { $set: {
                    otherDetails   // store the whole row inside `otherDetails`
                }},       // dynamically set all fields from Excel row
            { upsert: true }     // create new if not exists
        );
    }

    return res.status(200).json({status: 200, message: "Other details Imported/Updated Successfully!"});
}

module.exports = {
    createEmployee,
    getAllEmployees,
    updateEmployee,
    getSingleEmployee,
    deleteMultipleEmployees,
    employeeOtherDetail
};
