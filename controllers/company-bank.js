const CompanyBank = require('../models/company-banks');

// CREATE a new company bank
async function createCompanyBank(req, res) {
  try {
    const { companyId } = req.params;
    const bank = new CompanyBank({ ...req.body, company: companyId });
    await bank.save();
    res.status(201).json(bank);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// READ all company banks for a company
async function getCompanyBanks(req, res) {
  try {
    const { companyId } = req.params;
    const banks = await CompanyBank.find({ company: companyId });
    res.json(banks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// READ a single company bank by ID
async function getCompanyBankById(req, res) {
  try {
    const bank = await CompanyBank.findById(req.params.id);
    if (!bank) return res.status(404).json({ error: 'Company bank not found' });
    res.json(bank);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// UPDATE a company bank by ID
async function updateCompanyBank(req, res) {
  try {
    const bank = await CompanyBank.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!bank) return res.status(404).json({ error: 'Company bank not found' });
    res.json(bank);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// DELETE a company bank by ID
async function deleteCompanyBank(req, res) {
  try {
    const bank = await CompanyBank.findByIdAndDelete(req.params.id);
    if (!bank) return res.status(404).json({ error: 'Company bank not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createCompanyBank,
  getCompanyBanks,
  getCompanyBankById,
  updateCompanyBank,
  deleteCompanyBank,
};