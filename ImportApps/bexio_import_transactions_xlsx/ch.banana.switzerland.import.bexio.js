// Copyright [2018] [Banana.ch SA - Lugano Switzerland]
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
//
// @id = ch.banana.switzerland.import.bexio.js
// @api = 1.0
// @pubdate = 2022-12-19
// @publisher = Banana.ch SA
// @description = Bexio - Import transactions (*xlxs)
// @doctype = 100.*
// @encoding = utf-8
// @task = import.transactions
// @inputdatasource = openfiledialog
// @inputfilefilter = Text files (*.txt *.csv);;All files (*.*)
// @inputfilefilter.de = Text (*.txt *.csv);;Alle Dateien (*.*)
// @inputfilefilter.fr = Texte (*.txt *.csv);;Tous (*.*)
// @inputfilefilter.it = Testo (*.txt *.csv);;Tutti i files (*.*)
// @includejs = import.utilities.js

/*
 *   SUMMARY
 *
 *   Import transactions form Bexio to Banana using document change.
 *   After importing the data, the user must arrange the imported accounts
 *   in the accounts table by setting the correct Bclass and currency for them.
 * 
 */

/**
 * function called from converter
 */

function exec(inData) {

    if (!Banana.document || inData.length <= 0) {
        return "@Cancel";
    }

    var importUtilities = new ImportUtilities(Banana.document);

    if (!importUtilities.verifyBananaAdvancedVersion())
        return "";

    convertionParam = defineConversionParam(inData);
    let transactions = Banana.Converter.csvToArray(inData, convertionParam.separator, convertionParam.textDelim);

    //Format 1 (fare controllo del match nel caso ci siano più versioni)
    let  bexioTransactionsImportFormat1 = new BexioTransactionsImportFormat1(Banana.document);
    bexioTransactionsImportFormat1.createJsonDocument(transactions);

    var jsonDoc = { "format": "documentChange", "error": "" };
    jsonDoc["data"] = bexioTransactionsImportFormat1.jsonDocArray;

    return jsonDoc;

}
function setup() {}

/**
 * 
 * @param {*} banDocument the current Banana file
 */
var BexioTransactionsImportFormat1 = class BexioTransactionsImportFormat1 {
    constructor(banDocument) {
        this.version = '1.0';
        this.banDocument = banDocument;
        this.transNr = "";
        this.vatTransactionsList = [];

        //array dei patches
        this.jsonDocArray = [];

        //columns
        this.trDate = 0;
        this.trReference = 1;
        this.trDebit = 2;
        this.trCredit = 3;
        this.trDescription = 4;
        this.trAmount = 5;
        this.trCurrency = 6;
        this.trExchangeRate = 7;
        this.amountInBaseCurrency = 8;
        this.vatRate = 10;

    }

    /**
     * The createJsonDocument() method takes the transactions in the excel file and
     * creates the Json document with the data to insert into the transactions and accounts
     * table.
     */
    createJsonDocument(transactions) {

        var jsonDoc = this.createJsonDocument_Init();

        /**
         * ADD THE ACCOUNTS
         * Actually the accounts are added at the end of the accounts table, 
         * the user must then arrange them themselves within the table,
        */
        this.createJsonDocument_AddAccounts(transactions, jsonDoc);
        /** ADD VAT CODES */
        this.createJsonDocument_AddVatCodes(transactions, jsonDoc);
        /*ADD THE TRANSACTIONS*/
        this.createJsonDocument_AddTransactions(transactions, jsonDoc);

        this.jsonDocArray.push(jsonDoc);

    }

    /**
     * Creates the document change object for the account table.
     * The new accounts list is taken from the debit and credit columns, those
     * columns contains the description and the number of the accounts used in the transactions.
     * Accounts that already exists in the chart of accounts are not inserted.
     * @param {*} inData original transactions.
     */
    createJsonDocument_AddAccounts(transactions,jsonDoc) {

        let rows=[];
        let newAccountsData = {}; //will contain new accounts data.
        let accountsList = [];
        let columnsIndxList = [];
        let existingAccounts;
        let debitCol = this.trDebit;
        let creditCol = this.trCredit;

        columnsIndxList.push(debitCol);
        columnsIndxList.push(creditCol);

        accountsList = this.getFileColumnsData(transactions,columnsIndxList);
        /**Create an object with the new accounts data*/
        this.setNewAccountsData(accountsList,newAccountsData);
        /* Get the list of existing accounts*/
        existingAccounts = this.getExistingData("Accounts","Account");
        /* Filter the account by removing the existing ones */
        this.filterAccountsData(newAccountsData,existingAccounts);

        //add new accounts to the doc change json.
        if(newAccountsData && newAccountsData.data.length>=0){
            for(var key in newAccountsData.data){
                let account = newAccountsData.data[key].account;
                let description = newAccountsData.data[key].description;
                
                //new rows
                let row = {};
                row.operation = {};
                row.operation.name = "add";
                row.operation.srcFileName = "" //to define.
                row.fields = {};
                row.fields["Account"] = account;
                row.fields["Description"] = description;
                row.fields["Currency"] = this.banDocument.info("AccountingDataBase","BasicCurrency"); //actually set the base currency to all.

                rows.push(row);
            }
        }


        var dataUnitFilePorperties = {};
        dataUnitFilePorperties.nameXml = "Accounts";
        dataUnitFilePorperties.data = {};
        dataUnitFilePorperties.data.rowLists = [];
        dataUnitFilePorperties.data.rowLists.push({ "rows": rows });

        jsonDoc.document.dataUnits.push(dataUnitFilePorperties);

    }

    /**
     * Filter accounts data that already exists in the account table
     * by removing them from the "newAccountsData" object.
     */
    filterAccountsData(newAccountsData,existingAccounts){
        let newArray = [];
        if(newAccountsData){
            for(var key in newAccountsData.data){
                const elementObj = newAccountsData.data[key];
                if(elementObj && elementObj.account){
                    // check if the account number already exists
                    if(!existingAccounts.includes(elementObj.account)){
                        newArray.push(elementObj);
                    }
                }
            }
        }
        //overvrite the old array with the new one (filtered one).
        newAccountsData.data = newArray;
    }

    /**
     * Given a list of accounts creates an object containing for each account
     * the account number and the account description.
     */
    setNewAccountsData(accountsList,newAccountsData){
        let accountsData = [];
        if(accountsList.length>=0){
            for (var i = 0; i<accountsList.length; i++){
                let element = accountsList[i];
                let accDescription = "";
                let accountNr = "";
                let accData = {};

                if(element){
                    accDescription = element.substring(element.length-1,element.indexOf('-')+1);
                    accountNr = this.getAccountFromTextField(element);

                    accData.account = accountNr.trim();
                    accData.description = accDescription.trim();
    
                    accountsData.push(accData);
                }
            }
        }
        newAccountsData.data = accountsData;
    }

    /**
     * Finds and returns the account number contained in the debit or credit fields (Bexio file).
     * Each description follow this format:
     *  - "1020 - Post"
     *  - "1000 - Bank"
     * @param {*} rowField 
     */
    getAccountFromTextField(rowField){
        let account;
        if(rowField){
            account = rowField.substring(0,rowField.indexOf(' '));
            account.trim();
        }

        return account;
    }

    /**
     * Creates the document change object fot vat table
     */
    createJsonDocument_AddVatCodes(transactions, jsonDoc){
        //get the vat code list from the transactions
        let vatCodesList = [];
        let newVatCodesData = {};
        let columnsIndxList = [];
        let existingVatCodes = [];
        let rows =[];
        
        columnsIndxList.push(this.vatRate);

        vatCodesList = this.getFileColumnsData(transactions,columnsIndxList);
        /**Create an object with the new accounts data*/
        this.setNewVatCodesData(vatCodesList,newVatCodesData);
        existingVatCodes = this.getExistingData("VatCodes","VatCode");
        this.filterVatCodesData(newVatCodesData,existingVatCodes);

        //add new vat codes to the doc change json.
        if(newVatCodesData && newVatCodesData.data.length>=0){
            for(var key in newVatCodesData.data){
                let code = newVatCodesData.data[key].code;
                let rate = newVatCodesData.data[key].rate;
                
                //new rows
                let row = {};
                row.operation = {};
                row.operation.name = "add";
                row.operation.srcFileName = "" //to define.
                row.fields = {};
                row.fields["VatCode"] = code;
                row.fields["VatRate"] = rate;

                rows.push(row);
            }
        }


        var dataUnitFilePorperties = {};
        dataUnitFilePorperties.nameXml = "VatCodes";
        dataUnitFilePorperties.data = {};
        dataUnitFilePorperties.data.rowLists = [];
        dataUnitFilePorperties.data.rowLists.push({ "rows": rows });

        jsonDoc.document.dataUnits.push(dataUnitFilePorperties);
    }

    /**
     * Filter vat codes data that already exists in the vat table
     * by removing them from the "newVatCodesData" object.
     */
    filterVatCodesData(newVatCodesData,existingVatCodes){
        let newArray = [];
        let mappedVatCodes = this.getMappedVatCodes();
        if(newVatCodesData){
            for(var key in newVatCodesData.data){
                const elementObj = newVatCodesData.data[key];
                if(elementObj && elementObj.code){
                    /**Check if the account number already exists
                     * in the vat table or if it's already between mapped elements*/
                    if(!existingVatCodes.includes(elementObj.code) &&
                        !mappedVatCodes.has(elementObj.code)){
                            newArray.push(elementObj);
                    }
                }
            }
        }
        //overvrite the old array with the new one (filtered one).
        newVatCodesData.data = newArray;
    }

    /**
     * Given a list of accounts creates an object containing for each account
     * the account number and the account description.
     */
    setNewVatCodesData(vatCodesList,newVatCodesData){
        let vatCodesData = [];
        if(vatCodesList.length>=0){
            for (var i = 0; i<vatCodesList.length; i++){
                let element = vatCodesList[i];
                let vatCode = "";
                let vatRate = "";
                let vatData = {};

                if(element){
                    vatCode = this.getCodeFromVatField();
                    vatRate = element.substring(element.indexOf('(')+1, element.indexOf('%'));

                    vatData.code = vatCode.trim();
                    vatData.rate = vatRate.trim();
    
                    vatCodesData.push(vatData);
                }
            }
        }
        newVatCodesData.data = vatCodesData;
    }

    /**
     * Returns a set containing the values in the columns defined in "columns".
     * We use a set to filter out any repeated values (accounts, vat codes, etc).
     * @param {*} transactions
     */
    getFileColumnsData(transactions,columnsIndxList){
        const accounts = new Set();
        for (var i = 1; i<transactions.length; i++){
            let tRow = transactions[i];
            if(columnsIndxList.length>=0){
                for(var j = 0; j<columnsIndxList.length; j++){
                    let columnData = tRow[columnsIndxList[j]];
                    accounts.add(columnData);
                }
            }
        }
        //convert the set into an array, as it is more easy to manage.
        let vatCodesArray = Array.from(accounts);
        return vatCodesArray;
    }

    /**
     * Returns the list of the existing accounts
     * in the account table.
     */
    getExistingData(tableName,columnName){
        let accounts = [];
        let accountTable = this.banDocument.table(tableName);
        if(accountTable){
            let tRows = accountTable.rows;
            for(var key in tRows){
                let row = tRows[key];
                let account = row.value(columnName);
                if(account){
                    accounts.push(account);
                };
            }
        }
        return accounts;
    }

    /**
     * Finds and returns the vat code contained in the MWST field (Bexio file).
     * field format:
     *  - "UN77 (7.70%)"
     *  - "UR25 (2.50%)"
     */
    getCodeFromVatField(rowField){
        let code = "";
        if(rowField){
            code = rowField.substring(0,rowField.indexOf(' '));
            code.trim();
        }

        return code;
    }

    /**
     * Creates the document change object for the transactions table.
     */
    createJsonDocument_AddTransactions(transactions, jsonDoc) {

        let rows=[];

        /*Loop trough the transactions starting from the first line of data (= 1)*/
        for (var i = 1; i<transactions.length; i++){
            let tRow = transactions[i];
            let vatCode = this.getBananaVatCode(this.getCodeFromVatField(tRow[this.vatRate]));

            let row = {};
            row.operation = {};
            row.operation.name = "add";
            row.operation.srcFileName = "" //to define.
            row.fields = {};
            row.fields["Date"] = Banana.Converter.toInternalDateFormat(tRow[this.trDate],"dd-mm-yyyy");
            row.fields["ExternalReference"] = tRow[this.trReference];
            row.fields["AccountDebit"] = this.getAccountFromTextField(tRow[this.trDebit]);
            row.fields["AccountCredit"] = this.getAccountFromTextField(tRow[this.trCredit]);
            row.fields["Description"] = tRow[this.trDescription];
            row.fields["AmountCurrency"] = tRow[this.trAmount];
            row.fields["ExchangeCurrency"] = tRow[this.trCurrency];
            row.fields["ExchangeRate"] = tRow[this.trExchangeRate];
            row.fields["Amount"] = tRow[this.amountInBaseCurrency];
            if(vatCode)
                row.fields["VatCode"] = vatCode;
            else{
                /**the vat code is not bwtween the mapped ones
                 * so we inserted it int the vat codes table.
                 */
                row.fields["VatCode"] = tRow[this.vatRate];
            }

            rows.push(row);
        }

        var dataUnitFilePorperties = {};
        dataUnitFilePorperties.nameXml = "Transactions";
        dataUnitFilePorperties.data = {};
        dataUnitFilePorperties.data.rowLists = [];
        dataUnitFilePorperties.data.rowLists.push({ "rows": rows });

        jsonDoc.document.dataUnits.push(dataUnitFilePorperties);
    }

    /**
     * initialises the structure for document change.
     * @returns 
     */
    createJsonDocument_Init() {

        var jsonDoc = {};
        jsonDoc.document = {};
        jsonDoc.document.dataUnitsfileVersion = "1.0.0";
        jsonDoc.document.dataUnits = [];

        jsonDoc.creator = {};
        var d = new Date();
        var datestring = d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2);
        var timestring = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
        //jsonDoc.creator.executionDate = Banana.Converter.toInternalDateFormat(datestring, "yyyymmdd");
        //jsonDoc.creator.executionTime = Banana.Converter.toInternalTimeFormat(timestring, "hh:mm");
        jsonDoc.creator.name = Banana.script.getParamValue('id');
        jsonDoc.creator.version = "1.0";

        return jsonDoc;

    }

    /**
     * Dato un coidce iva Bexio ritorna il codice corrispondente in Banana.
     */
    getBananaVatCode(bxVatCode){
        if(bxVatCode){
            let mpdVatCodes = this.getMappedVatCodes();
            let banVatCode;

            /**get the Banana vat code */
            banVatCode = mpdVatCodes.get(bxVatCode);

            if(banVatCode){
                return banVatCode;
            }
        }

        return "";
    }

    /**
     * Ritorna la struttura contenente i codici iva mappati da Bexio
     * questa struttura contiene i codici standard, non funziona in 
     * caso in cui l'utente abbia personalizzato la tabella codici iva.
     */
    getMappedVatCodes(){
        /**
         * Map structure:
         * key = Bexio vat code
         * value = Banana vat code
         */
        const vatCodes = new Map ()

        //set codes
        vatCodes.set("UN77","V77");
        vatCodes.set("UR25","V25");

        return vatCodes;
    }
}

function defineConversionParam(inData) {
	var convertionParam = {};
	/** SPECIFY THE SEPARATOR AND THE TEXT DELIMITER USED IN THE CSV FILE */
	convertionParam.format = "csv"; // available formats are "csv", "html"
	//get text delimiter
	convertionParam.textDelim = '\"';
	// get separator
	convertionParam.separator = findSeparator(inData);
  
	/** SPECIFY THE COLUMN TO USE FOR SORTING
	If sortColums is empty the data are not sorted */
	convertionParam.sortColums = ["Date", "Description"];
	convertionParam.sortDescending = false;
  
	return convertionParam;
}

/**
 * The function findSeparator is used to find the field separator.
 */
  function findSeparator(inData) {

	var commaCount=0;
	var semicolonCount=0;
	var tabCount=0;
 
	for(var i = 0; i < 1000 && i < inData.length; i++) {
	   var c = inData[i];
	   if (c === ',')
		  commaCount++;
	   else if (c === ';')
		  semicolonCount++;
	   else if (c === '\t')
		  tabCount++;
	}
 
	if (tabCount > commaCount && tabCount > semicolonCount)
	{
	   return '\t';
	}
	else if (semicolonCount > commaCount)
	{
	   return ';';
	}
 
	return ',';
 }