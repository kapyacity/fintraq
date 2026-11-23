/**
 * FinTraQ Google Sheets Audit Sync — Google Apps Script
 * 
 * SETUP INSTRUCTIONS (Takes ~2 minutes):
 * 1. Open Google Sheets (https://sheets.new) to create a new spreadsheet.
 * 2. Name it "FinTraQ Audit Log".
 * 3. In the top menu, click Extensions > Apps Script.
 * 4. Erase any code in the editor and paste THIS ENTIRE FILE.
 * 5. Click the blue "Deploy" button (top right) > "New deployment".
 * 6. Under "Select type", choose "Web app".
 * 7. Set:
 *    - Description: "FinTraQ Webhook"
 *    - Execute as: "Me" (your email)
 *    - Who has access: "Anyone" (allows your phone/browser to post without complex OAuth)
 * 8. Click "Deploy", approve Google's standard permissions prompt.
 * 9. Copy the "Web app URL" (starts with https://script.google.com/macros/s/.../exec).
 * 10. In FinTraQ > Settings > Google Sheets Audit Sync, paste the URL and click Save.
 */

function doPost(e) {
  try {
    var raw = e.postData ? e.postData.contents : '';
    if (!raw) return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No payload' })).setMimeType(ContentService.MimeType.JSON);
    
    var data = JSON.parse(raw);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (data.action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'FinTraQ Google Sheet Webhook connected!' })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (data.action === 'batch_sync') {
      handleBatchSync(ss, data);
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', count: (data.expenses ? data.expenses.length : 0) + (data.inflows ? data.inflows.length : 0) })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (data.action === 'weekly_backup') {
      handleBatchSync(ss, data);
      var backupSheet = getOrCreateSheet(ss, "Weekly Backups", [
        "Timestamp", "Date (IST)", "Expenses Count", "Inflows Count", "Funds Count", "Loans Count", "Status"
      ]);
      var now = new Date();
      var dateStr = Utilities.formatDate(now, "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss");
      backupSheet.appendRow([
        now.getTime(),
        dateStr,
        data.expenses ? data.expenses.length : 0,
        data.inflows ? data.inflows.length : 0,
        data.funds ? data.funds.length : 0,
        data.loans ? data.loans.length : 0,
        "Snapshot Complete ✓"
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'Weekly backup logged' })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Single transaction log
    logTransaction(ss, data);
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("FinTraQ Audit Webhook is Active. Send POST requests to log transactions.").setMimeType(ContentService.MimeType.TEXT);
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f4f6");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function logTransaction(ss, item) {
  var auditSheet = getOrCreateSheet(ss, "Audit Log", [
    "Timestamp", "Date (IST)", "Type", "Category / Source", "Subcategory / Target", "Amount (₹)", "Note", "ID"
  ]);
  
  var ts = item.ts ? new Date(item.ts) : new Date();
  var dateStr = Utilities.formatDate(ts, "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss");
  
  auditSheet.appendRow([
    ts.getTime(),
    dateStr,
    item.type || 'Transaction',
    item.cat || item.source || '-',
    item.sub || item.fundName || '-',
    item.amount || 0,
    item.note || '',
    item.id || ''
  ]);
  
  // Specific sheets
  if (item.type === 'Expense') {
    var expSheet = getOrCreateSheet(ss, "Expenses", ["Date", "Category", "Subcategory", "Amount (₹)", "Note", "ID"]);
    expSheet.appendRow([dateStr, item.cat, item.sub, item.amount, item.note, item.id]);
  } else if (item.type === 'Inflow') {
    var incSheet = getOrCreateSheet(ss, "Inflows", ["Date", "Source", "Amount (₹)", "Note", "ID"]);
    incSheet.appendRow([dateStr, item.source, item.amount, item.note, item.id]);
  } else if (item.type === 'Fund Deposit' || item.type === 'Fund Withdrawal') {
    var fundSheet = getOrCreateSheet(ss, "Funds", ["Date", "Action", "Fund Name", "Amount (₹)", "Balance (₹)", "Note"]);
    fundSheet.appendRow([dateStr, item.type, item.fundName, item.amount, item.balanceAfter, item.note]);
  } else if (item.type === 'Loan Payment') {
    var loanSheet = getOrCreateSheet(ss, "Loan Payments", ["Date", "Loan Name", "EMI Amount (₹)", "Remaining Balance (₹)", "Month Key"]);
    loanSheet.appendRow([dateStr, item.loanName, item.amount, item.remainingAfter, item.monthKey]);
  }
}

function handleBatchSync(ss, payload) {
  if (payload.expenses && payload.expenses.length) {
    var expSheet = getOrCreateSheet(ss, "Expenses", ["Date", "Category", "Subcategory", "Amount (₹)", "Note", "ID"]);
    payload.expenses.forEach(function(e) {
      if (e.deleted) return;
      var d = Utilities.formatDate(new Date(e.ts), "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss");
      expSheet.appendRow([d, e.cat, e.sub, e.amount, e.note, e.id]);
    });
  }
  if (payload.incomes && payload.incomes.length) {
    var incSheet = getOrCreateSheet(ss, "Inflows", ["Date", "Source", "Amount (₹)", "Note", "ID"]);
    payload.incomes.forEach(function(i) {
      if (i.deleted) return;
      var d = Utilities.formatDate(new Date(i.ts), "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss");
      incSheet.appendRow([d, i.source, i.amount, i.note, i.id]);
    });
  }
}
