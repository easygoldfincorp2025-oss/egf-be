const SchemeModel = require('../models/scheme');

async function getUnsecureLoanAmt(scheme, loanAmount) {
    console.log("loanAmount in fn", loanAmount)
    const {interestRate} = await SchemeModel.findById(scheme).select('interestRate');
    console.log("schemeInterest", interestRate)
    return Number(((Number(interestRate) - 1)/1.25) * Number(loanAmount));
}

module.exports = {getUnsecureLoanAmt}