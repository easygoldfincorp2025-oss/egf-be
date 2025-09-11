const express = require('express');
const router = express.Router();
const companyBanksController = require('../controllers/company-bank');

router.post('/:companyId/bank', companyBanksController.createCompanyBank);
router.get('/:companyId/bank', companyBanksController.getCompanyBanks);
router.get('/:companyId/bank/:id', companyBanksController.getCompanyBankById);
router.put('/:companyId/bank/:id', companyBanksController.updateCompanyBank);
router.delete('/:companyId/bank/:id', companyBanksController.deleteCompanyBank);

module.exports = router;