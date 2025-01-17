// @id = ch.banana.switzerland.import.postfinance
// @api = 1.0
// @pubdate = 2023-05-09
// @publisher = Banana.ch SA
// @description = Postfinance - Import account statement .csv (Banana+ Advanced)
// @description.de = Postfinance - Bewegungen importieren .csv (Banana+ Advanced)
// @description.en = Postfinance - Import account statement .csv (Banana+ Advanced)
// @description.fr = Postfinance - Importer mouvements .csv (Banana+ Advanced)
// @description.it = Postfinance - Importa movimenti .csv (Banana+ Advanced)
// @doctype = *
// @docproperties =
// @task = import.transactions
// @outputformat = transactions.simple
// @includejs = import.utilities.js
// @inputdatasource = openfiledialog
// @inputencoding = latin1
// @inputfilefilter = Text files (*.txt *.csv);;All files (*.*)
// @inputfilefilter.de = Text (*.txt *.csv);;Alle Dateien (*.*)
// @inputfilefilter.fr = Texte (*.txt *.csv);;Tous (*.*)
// @inputfilefilter.it = Testo (*.txt *.csv);;Tutti i files (*.*)

/**
 * Parse the data and return the data to be imported as a tab separated file.
 */
function exec(inData, isTest) {

   if (!inData) return "";

   var importUtilities = new ImportUtilities(Banana.document);

   if (isTest !== true && !importUtilities.verifyBananaAdvancedVersion())
      return "";

   if (inData.indexOf("<html") >= 0) {
      var formatHtml1 = new PFHtmlFormat1();
      var rows = formatHtml1.convert(inData);
      var csv = Banana.Converter.objectArrayToCsv(
         ["Date", "DateValue", "Description", "Income", "Expenses"],
         rows);
      return csv;

   } else {
      var fieldSeparator = findSeparator(inData);
      var transactions = Banana.Converter.csvToArray(inData, fieldSeparator);

      // Format 4
      var format4 = new PFCSVFormat4();
      if (format4.match(transactions)) {
         transactions = format4.convert(transactions);
         return Banana.Converter.arrayToTsv(transactions);
      }

      // Format SBU 1
      var formatSBU1 = new PFCSVFormatSBU1();
      if (formatSBU1.match(transactions)) {
         transactions = formatSBU1.convert(transactions);
         return Banana.Converter.arrayToTsv(transactions);
      }

      // Format 3
      var format3 = new PFCSVFormat3();
      if (format3.match(transactions)) {
         transactions = format3.convert(transactions);
         return Banana.Converter.arrayToTsv(transactions);
      }

      // Format 2
      var format2 = new PFCSVFormat2();
      if (format2.match(transactions)) {
         transactions = format2.convert(transactions);
         return Banana.Converter.arrayToTsv(transactions);
      }

      // Format 1
      var format1 = new PFCSVFormat1();
      if (format1.match(transactions)) {
         transactions = format1.convert(transactions);
         return Banana.Converter.arrayToTsv(transactions);
      }
   }

   importUtilities.getUnknownFormatError();

   return "";
}

/**
 * PFCSV Format 4
 * Example: pfcsv.#20230509
 * Fœnum porto natio:;0000 8003 3386 9363
 * Natio:;LIAM LIAM LIAM 5526 PecuLeverba Aturaequat Cocet Voluna
 * Tuundit nostinsan:;06.04.2022 - 05.05.2022
 * Data;Denominazione;Accredito in CHF;Addebito in CHF;Importo in CHF
 * 2022-05-04;"ARTION *PRATIUNDICO      52163467544  XXX";;52.00;
 * 2022-05-04;"1.7% SUPPL. CHF ALL'ESTERO";;0.88;
 * 2022-05-04;"ARTION *EXPECT CUNT      1324126664   NOS";;21.93;
 * 2022-05-03;"ARTION *EXPECT CUNT      1324126664   NOS";;11.11;
 * 2022-05-03;"ARTION *MENTIO SET       1324126664   STO";;15.00;
 * 2022-05-03;"1.7% SUPPL. CHF ALL'ESTERO";;0.26;
 * 2022-05-02;"PATTINDE NATHOC FŒNUM NATIO";300.00;;
 * 2022-05-01;"ARATIMOTE PATUBIT        MODO CONDE MONCH NIS 0.56 Effect 8.1480 ost 37.77.6604 TER 0.62 8.52% de todivispect cor pasus fertumquobsemo TER 0.77";;8.44;
**/
function PFCSVFormat4() {

   this.colDate = 0;
   this.colDescr = 1;
   this.colCredit = 2;
   this.colDebit = 3;
   this.colAmount = 4;

   this.dateFormat = 'dd-mm-yyyy';

   /** Return true if the transactions match this format */
   this.match = function (transactions) {
      if (transactions.length === 0)
         return false;

      for (i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];

         var formatMatched = false;
         if (transaction.length === this.colAmount + 1)
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched && transaction[this.colDate].match(/[0-9]{2}(\.)[0-9]{2}(\.)[0-9]{2}/g)) {
            this.dateFormat = 'dd.mm.yy';
            formatMatched = true;
         } else if (formatMatched && transaction[this.colDate].match(/[0-9]{2}(\.|-)[0-9]{2}(\.|-)[0-9]{4}/g)) {
            formatMatched = true;
         } else if (formatMatched && transaction[this.colDate].match(/[0-9]{4}(\.|-)[0-9]{2}(\.|-)[0-9]{2}/g)) {
            formatMatched = true;
            this.dateFormat = 'yyyy-mm-dd';
         } else {
            formatMatched = false;
         }

         if (formatMatched)
            return true;
      }

      return false;
   }

   /** Convert the transaction to the format to be imported */
   this.convert = function (transactions) {
      var transactionsToImport = [];

      // Filter and map rows
      for (i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];
         if (transaction.length < (this.colAmount + 1))
            continue;
         if (transaction[this.colDate].match(/[0-9]{2,4}(\.|-)[0-9]{2}(\.|-)[0-9]{2,4}/g) && transaction[this.colDate].length == 10)
            transactionsToImport.push(this.mapTransaction(transaction));
      }

      // Sort rows by date (just invert)
      transactionsToImport = transactionsToImport.reverse();

      // Add header and return
      var header = [["Date", "Doc", "Description", "Income", "Expenses"]];
      return header.concat(transactionsToImport);
   }


   this.mapTransaction = function (element) {
      var mappedLine = [];

      mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colDate], this.dateFormat));
      mappedLine.push(""); // Doc is empty for now
      var tidyDescr = element[this.colDescr].replace(/ {2,}/g, ''); //remove white spaces
      mappedLine.push(Banana.Converter.stringToCamelCase(tidyDescr));
      var amount = element[this.colCredit].replace(/-/g, ''); //remove minus sign
      mappedLine.push(Banana.Converter.toInternalNumberFormat(amount));
      amount = element[this.colDebit].replace(/-/g, ''); //remove minus sign
      mappedLine.push(Banana.Converter.toInternalNumberFormat(amount));

      return mappedLine;
   }
}

/**
 * PF Html Format 1
 * Html table with the followings colums:
 * 0:Details; 1:Date; 2:Description; 3:Income; 4:Expenses; 5:DateValue; 6:Balance;
**/
function PFHtmlFormat1() {

   /** This function defines the convertion of the single html table rows to Banana fields.
     This is the only function to be adapted to the desired format. */
   this.htmlRowToObject = function (htmlString) {

      // Extract html fields (tags td)
      var htmlTableFields = htmlString.match(/<td[^>]*>[\s\S]*?<\/td>/g); //[\s\S]*? match all chars non gready
      if (!htmlTableFields)
         return null;

      // Verify fields count
      if (htmlTableFields.length < 6)
         return null;

      // Verify if date field match
      var date = this.htmlText(htmlTableFields[1]);
      if (!date.match(/[0-9.]{8}/))
         return null;

      // Convert row
      var rowObject = {};
      rowObject.Date = Banana.Converter.toInternalDateFormat(this.htmlText(htmlTableFields[1]));
      rowObject.Description = Banana.Converter.stringToCamelCase(this.htmlText(htmlTableFields[2]));
      rowObject.ContraAccount = "";
      rowObject.Income = Banana.Converter.toInternalNumberFormat(this.htmlText(htmlTableFields[3]));
      rowObject.Expenses = Banana.Converter.toInternalNumberFormat(this.htmlText(htmlTableFields[4]));
      rowObject.DateValue = Banana.Converter.toInternalDateFormat(this.htmlText(htmlTableFields[5]));
      rowObject._Balance = Banana.Converter.toInternalNumberFormat(this.htmlText(htmlTableFields[6]));
      return rowObject;
   }

   /** This function extract from the html the data to be imported in Banana Accounting.
       It use the function htmlRowToObject to convert the single data rows. */
   this.convert = function (htmlString) {
      var rows = [];
      var htmlTables = htmlString.match(/<tbody[^>]*>[\s\S]*?<\/tbody>/g);  //[\s\S]*? match all chars non gready
      if (htmlTables) {
         for (var t = 0; t < htmlTables.length; t++) {
            var htmlTableRows = htmlTables[t].match(/<tr[^>]*>[\s\S]*?<\/tr>/g); //[\s\S]*? match all chars non gready
            if (htmlTableRows) {
               for (var r = 0; r < htmlTableRows.length; r++) {
                  var row = this.htmlRowToObject(htmlTableRows[r]);
                  if (row) {
                     rows.push(row);
                  }
               }
            }
         }
      }
      return rows;
   }

   /** This function extract the text inside an html element */
   this.htmlText = function (htmlString) {
      // Read text from html string
      // The text is found between each ">...<" sequence
      var retText = "";
      var htmlTexts = htmlString.match(/>[^<]+</g);
      if (htmlTexts) {
         for (var i = 0; i < htmlTexts.length; i++) {
            var htmlSubText = htmlTexts[i];
            if (htmlSubText.length > 2)
               retText = retText + htmlSubText.substr(1, htmlSubText.length - 2);
         }
      }

      // Remove line feeds
      retText = retText.replace(/^[ \n\r]+/, ""); // at the beginning
      retText = retText.replace(/[ \n\r]+$/, ""); // at the end
      retText = retText.replace(/ *[\n\r]+ */g, ", "); // in the middle

      return retText;
   }
}

/**
 * PFCSV Format 3
 * Example: pfcsv.#20101031
 * BookingDate;BookingText;Details;ValutaDate;DebitAmount;CreditAmount;Balance
 * 31.10.2010;FÜR DAS ONLINE-SET SEPTEMBER XXXX;;31.10.2010;;0.00;5831.73
 * 29.10.2010;E-FINANCE XXX;1;29.10.2010;-45.00;;5831.73
 * 29.10.2010;E-FINANCE XXX;1;29.10.2010;-131.55;;
 * Example: pfcsv.#20131231
 * Buchung;Buchungstext;Details;Valuta;Belastung;Gutschrift;Saldo;Kategorie;Familienmitglied;Kommentar
 * "31.12.2013";"ZINSABSCHLUSS 010113 - 311213";"";"31.12.2013";"-0.15";"";"2549.30";"";"";""
 * "24.12.2013";"KAUF/DIENSTLEISTUNG
 * VOM 23.12.2013
 * KARTEN NR. 82770597
 * CUCINA PERO AG
 * WƒDENSWIL";"1";"23.12.2013";"-124.00";"";"2549.45";"";"";""
**/
function PFCSVFormat3() {

   this.colDate = 0;
   this.colDescr = 1;
   this.colDateValuta = 3;
   this.colDebit = 4;
   this.colCredit = 5;
   this.colBalance = 6;
   this.colComment = 9;

   /** Return true if the transactions match this format */
   this.match = function (transactions) {
      if (transactions.length === 0)
         return false;

      for (i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];

         var formatMatched = false;
         if (transaction.length === (this.colBalance + 1) ||
            transaction.length === (this.colComment + 1))
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched && transaction[this.colDate].match(/[0-9]{2,4}(\.|-)[0-9]{2}(\.|-)[0-9]{2,4}/g) &&
            transaction[this.colDate].length === 10)
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched && transaction[this.colDateValuta].match(/[0-9]{2,4}(\.|-)[0-9]{2}(\.|-)[0-9]{2,4}/g) &&
            transaction[this.colDateValuta].length === 10)
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched)
            return true;
      }

      return false;
   }

   /** Convert the transaction to the format to be imported */
   this.convert = function (transactions) {
      var transactionsToImport = [];

      // Filter and map rows
      for (i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];
         if (transaction.length < (this.colBalance + 1))
            continue;
         if (transaction[this.colDate].match(/[0-9]{2,4}(\.|-)[0-9]{2}(\.|-)[0-9]{2,4}/g) && transaction[this.colDate].length == 10 &&
            transaction[this.colDateValuta].match(/[0-9]{2,4}(\.|-)[0-9]{2}(\.|-)[0-9]{2,4}/g) && transaction[this.colDateValuta].length == 10)
            transactionsToImport.push(this.mapTransaction(transaction));
      }

      // Sort rows by date (just invert)
      transactionsToImport = transactionsToImport.reverse();

      // Add header and return
      var header = [["Date", "DateValue", "Doc", "Description", "Income", "Expenses"]];
      return header.concat(transactionsToImport);
   }


   this.mapTransaction = function (element) {
      var mappedLine = [];

      mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colDate], 'dd-mm-yyyy'));
      mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colDateValuta], 'dd-mm-yyyy'));
      mappedLine.push(""); // Doc is empty for now
      var tidyDescr = element[this.colDescr].replace(/ {2,}/g, ''); //remove white spaces
      mappedLine.push(Banana.Converter.stringToCamelCase(tidyDescr));
      var amount = element[this.colCredit].replace(/-/g, ''); //remove minus sign
      mappedLine.push(Banana.Converter.toInternalNumberFormat(amount));
      amount = element[this.colDebit].replace(/-/g, ''); //remove minus sign
      mappedLine.push(Banana.Converter.toInternalNumberFormat(amount));

      return mappedLine;
   }
}


/**
 * PFCSV Format 2
 * Example: pfcsv.#private20090401
 * Example: pfcsv.#private20090401
 * Data	Testo d'avviso	Accredito	Addebito	Data della valuta	Saldo	
 * 20090401	/t ACQUISTO/SERVIZIO DEL XX.XX.XXXX  CARTA N. XXX	/t99.9	/t20090331	/t			/t
 * 20090331	/t ORDINE DEBIT DIRECT NUMERO CLIENTE XXX			/t85.9	/t20090331	/t7881.35	/t
 * 20090330	/t ACQUISTO/SERVIZIO DEL XX.XX.XXXX  CARTA N. XXX	/t43	/t20090328	/t7967.25	/t
 *
 *
**/
function PFCSVFormat2() {

   this.colDate = 0;
   this.colDescr = 1;
   this.colCredit = 2;
   this.colDebit = 3;
   this.colDateValuta = 4;
   this.colBalance = 5;

   /** Return true if the transactions match this format */
   this.match = function (transactions) {
      if (transactions.length === 0)
         return false;

      for (i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];

         var formatMatched = false;
         if (transaction.length === (this.colBalance + 2))
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched && transaction[this.colDate].match(/[0-9]{6}/g)
            && transaction[this.colDate].length === 8)
            formatMatched = true;

         if (formatMatched && transaction[this.colDateValuta].match(/[0-9]{6}/g) &&
            transaction[this.colDateValuta].length == 8)
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched)
            return true;
      }

      return false;
   }

   /** Convert the transaction to the format to be imported */
   this.convert = function (transactions) {
      var transactionsToImport = [];

      // Filter and map rows
      for (i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];
         if (transaction.length < (this.colBalance + 1))
            continue;
         if (transaction[this.colDate].match(/[0-9]+/g) && transaction[this.colDate].length == 8 &&
            transaction[this.colDateValuta].match(/[0-9]+/g) && transaction[this.colDateValuta].length == 8)
            transactionsToImport.push(this.mapTransaction(transaction));
      }

      // Sort rows by date (just invert)
      transactionsToImport = transactionsToImport.reverse();

      // Add header and return
      var header = [["Date", "DateValue", "Doc", "Description", "Income", "Expenses"]];
      return header.concat(transactionsToImport);
   }


   this.mapTransaction = function (element) {
      var mappedLine = [];

      mappedLine.push(element[this.colDate]);
      mappedLine.push(element[this.colDateValuta]);
      mappedLine.push(""); // Doc is empty for now
      var tidyDescr = element[this.colDescr].replace(/ {2,}/g, ' '); //remove white spaces
      mappedLine.push(Banana.Converter.stringToCamelCase(tidyDescr));
      mappedLine.push(Banana.Converter.toInternalNumberFormat(element[this.colCredit]));
      mappedLine.push(Banana.Converter.toInternalNumberFormat(element[this.colDebit]));

      return mappedLine;
   }
}


/**
 * PFCSV Format 1
 * Example: pfcsv.#20030903-B
 * Example: pfcsv.#20121101-B
 * Example: pfcsv.#20160707
 * Data;Descrizione della transazione;Accreditamento;Debito;Valuta;Saldo
 * 31.08.2003;Saldo;;;;50078.40
 * 01.09.2003;"YELLOWNET SAMMELAUFTRAG NR. X,YELLOWNET NUMMER XXXXXX";;-28.60;01.09.2003;50049.80
 * 01.09.2003;"AUFTRAG DEBIT DIRECT,AUFTRAGSNUMMER X,KUNDENNUMMER XXXX";26.80;;01.09.2003;50076.60
**/

function PFCSVFormat1() {

   this.colDate = 0;
   this.colDescr = 1;
   this.colCredit = 2;
   this.colDebit = 3;
   this.colDateValuta = 4;
   this.colBalance = 5;

   this.dateFormat = 'dd-mm-yyyy';
   this.decimalSeparator = '.';


   /** Return true if the transactions match this format */
   this.match = function (transactions) {
      if (transactions.length === 0)
         return false;

      for (i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];

         var formatMatched = false;
         if (transaction.length === (this.colBalance + 1) || transaction.length === (this.colBalance + 2))
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched && transaction[this.colDate].match(/[0-9]{2}(\.)[0-9]{2}(\.)[0-9]{2}/g)) {
            this.dateFormat = 'dd.mm.yy';
            formatMatched = true;
         } else if (formatMatched && transaction[this.colDate].match(/[0-9]{2}(\.|-)[0-9]{2}(\.|-)[0-9]{4}/g)) {
            formatMatched = true;
         } else if (formatMatched && transaction[this.colDate].match(/[0-9]{4}(\.|-)[0-9]{2}(\.|-)[0-9]{2}/g)) {
            formatMatched = true;
            this.dateFormat = 'yyyy-mm-dd';
         } else {
            formatMatched = false;
         }

         if (formatMatched && transaction[this.colDateValuta].match(/[0-9]{2,4}(\.|-)[0-9]{2}(\.|-)[0-9]{2,4}/g))
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched)
            return true;
      }

      return false;
   }


   /** Convert the transaction to the format to be imported */
   this.convert = function (transactions) {
      var transactionsToImport = [];

      // Filter and map rows
      for (i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];
         if (transaction.length < (this.colBalance + 1))
            continue;
         if (transaction[this.colDate].match(/[0-9\.]{3}/g) && transaction[this.colDateValuta].match(/[0-9\.]{3}/g))
            transactionsToImport.push(this.mapTransaction(transaction));
      }

      // Sort rows by date
      transactionsToImport = this.sort(transactionsToImport);

      // Add header and return
      var header = [["Date", "DateValue", "Doc", "Description", "Income", "Expenses"]];
      return header.concat(transactionsToImport);
   }


   /** Sort transactions by date */
   this.sort = function (transactions) {
      if (transactions.length <= 0)
         return transactions;
      var i = 0;
      var previousDate = transactions[0][this.colDate];
      while (i < transactions.length) {
         var date = transactions[i][this.colDate];
         if (previousDate.length > 0 && previousDate > date)
            return transactions.reverse();
         else if (previousDate.length > 0 && previousDate < date)
            return transactions;
         i++;
      }
      return transactions;
   }

   this.mapTransaction = function (element) {
      var mappedLine = [];

      mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colDate], this.dateFormat));
      mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colDateValuta], this.dateFormat));
      mappedLine.push(""); // Doc is empty for now
      var tidyDescr = element[this.colDescr].replace(/ {2,}/g, ''); //remove white spaces
      mappedLine.push(Banana.Converter.stringToCamelCase(tidyDescr));
      var amount = element[this.colCredit].replace(/\+/g, ''); //remove plus sign
      mappedLine.push(Banana.Converter.toInternalNumberFormat(amount, this.decimalSeparator));
      amount = element[this.colDebit].replace(/-/g, ''); //remove minus sign
      mappedLine.push(Banana.Converter.toInternalNumberFormat(amount, this.decimalSeparator));

      return mappedLine;
   }
}

/**
 * The function findSeparator is used to find the field separator.
 */
function findSeparator(string) {

   var commaCount = 0;
   var semicolonCount = 0;
   var tabCount = 0;

   for (var i = 0; i < 1000 && i < string.length; i++) {
      var c = string[i];
      if (c === ',')
         commaCount++;
      else if (c === ';')
         semicolonCount++;
      else if (c === '\t')
         tabCount++;
   }

   if (tabCount > commaCount && tabCount > semicolonCount) {
      return '\t';
   }
   else if (semicolonCount > commaCount) {
      return ';';
   }

   return ',';
}

/**
 * PFCSV Smart Business Format 1
 * Example: pfcsv.#20180220-SBU
 * "client_name";"paid_date";"paid_amount"
 * "Schaub Thomas";"21.02.2018";"100.00"
 * "Prins Carla";"20.02.2018";"150.00"
 * "Mario Wlotzka";"15.02.2018";"960.00"
**/

function PFCSVFormatSBU1() {

   this.colDate = 1;
   this.colDescr = 0;
   this.colCredit = 2;

   this.dateFormat = 'dd.mm.yyyy';
   this.decimalSeparator = '.';

   /** Return true if the transactions match this format */
   this.match = function (transactions) {
      if (transactions.length === 0)
         return false;

      for (i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];

         var formatMatched = false;
         if (transaction.length === (this.colCredit + 1))
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched && transaction[this.colDate].match(/[0-9]{2}(\.|-)[0-9]{2}(\.|-)[0-9]{4}/g)) {
            formatMatched = true;
         } else {
            formatMatched = false;
         }

         if (formatMatched)
            return true;
      }

      return false;
   }


   /** Convert the transaction to the format to be imported */
   this.convert = function (transactions) {
      var transactionsToImport = [];

      // Filter and map rows
      for (var i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];
         if (transaction.length < this.colCredit)
            continue;
         if (transaction[this.colDate].match(/[0-9\.]{3}/g))
            transactionsToImport.push(this.mapTransaction(transaction));
      }

      // Sort rows by date
      transactionsToImport = this.sort(transactionsToImport);

      // Add header and return
      var header = [["Date", "DateValue", "Doc", "Description", "Income", "Expenses"]];
      return header.concat(transactionsToImport);
   }


   /** Sort transactions by date */
   this.sort = function (transactions) {
      if (transactions.length <= 0)
         return transactions;
      var i = 0;
      var previousDate = transactions[0][this.colDate];
      while (i < transactions.length) {
         var date = transactions[i][this.colDate];
         if (previousDate.length > 0 && previousDate > date)
            return transactions.reverse();
         else if (previousDate.length > 0 && previousDate < date)
            return transactions;
         i++;
      }
      return transactions;
   }

   this.mapTransaction = function (element) {
      var mappedLine = [];

      mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colDate], this.dateFormat));
      mappedLine.push("");
      mappedLine.push("");
      mappedLine.push(element[this.colDescr]);
      mappedLine.push(Banana.Converter.toInternalNumberFormat(element[this.colCredit], this.decimalSeparator));
      mappedLine.push("");

      return mappedLine;
   }
}

/**
 * The function findSeparator is used to find the field separator.
 */
function findSeparator(string) {

   var commaCount = 0;
   var semicolonCount = 0;
   var tabCount = 0;

   for (var i = 0; i < 1000 && i < string.length; i++) {
      var c = string[i];
      if (c === ',')
         commaCount++;
      else if (c === ';')
         semicolonCount++;
      else if (c === '\t')
         tabCount++;
   }

   if (tabCount > commaCount && tabCount > semicolonCount) {
      return '\t';
   }
   else if (semicolonCount > commaCount) {
      return ';';
   }

   return ',';
}

