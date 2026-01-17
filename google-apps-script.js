// Handle GET requests to serve menu data
function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    // Check if it's a status check polling request
    if (e.parameter && e.parameter.action === 'check_status') {
      var result = checkOrderStatus(e.parameter.orderId);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data = getMenuData();

    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ 'result': 'error', 'error': e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Helper to poll order status from sheet
function checkOrderStatus(orderId) {
  if (!orderId) return { status: 'error', message: 'Missing Order ID' };

  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName('Orders');
  if (!sheet) return { status: 'error', message: 'Sheet not found' };

  var data = sheet.getDataRange().getValues();
  // Headers are row 1. Find columns by name to be safe.
  var headers = data[0];
  var idColIndex = headers.indexOf('Order ID');
  var statusColIndex = headers.indexOf('Status');

  if (idColIndex === -1) return { status: 'error', message: 'Order ID column not found' };
  // If Status column doesn't exist yet, we assume everything is 'Pending' unless verified elsewhere
  if (statusColIndex === -1) return { status: 'Pending' };

  // Iterate backwards to find latest
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idColIndex]) === String(orderId)) {
      var status = data[i][statusColIndex];
      return { status: status ? status : 'Pending' };
    }
  }

  return { status: 'Not Found' };
}

// Handle POST requests for submitting orders
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName('Orders');

    if (!sheet) {
      sheet = doc.insertSheet('Orders');
      // Create headers if new sheet
      sheet.appendRow([
        'Date',
        'Order ID',
        'Customer Name',
        'Phone',
        'Email',
        'Address',
        'Items',
        'Total',
        'Payment Method',
        'Chef Note (EN)',
        'Chef Note (ZH)',
        'Coordinates',
        'Receipt Image'
      ]);
    }

    // Ensure header exists if sheet existed but column didn't
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.indexOf('Receipt Image') === -1) {
      sheet.getRange(1, headers.length + 1).setValue('Receipt Image');
      headers.push('Receipt Image'); // Update local headers array
    }
    if (headers.indexOf('Status') === -1) {
      sheet.getRange(1, headers.length + 1).setValue('Status');
      headers.push('Status');
    }
    if (headers.indexOf('Items JSON') === -1) {
      sheet.getRange(1, headers.length + 1).setValue('Items JSON');
      headers.push('Items JSON');
    }

    var data = JSON.parse(e.postData.contents);
    var timestamp = new Date();

    // Handle Image Upload to Drive
    var receiptUrl = '';
    if (data.receiptBase64 && data.receiptMimeType) {
      try {
        var folderName = "TWS Receipts";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder;

        if (folders.hasNext()) {
          folder = folders.next();
        } else {
          folder = DriveApp.createFolder(folderName);
        }

        var decoded = Utilities.base64Decode(data.receiptBase64);
        var blob = Utilities.newBlob(decoded, data.receiptMimeType, "receipt_" + data.orderId);
        var file = folder.createFile(blob);

        // Ensure file is accessible if needed, but for internal use default permissions are usually fine
        receiptUrl = file.getUrl();
      } catch (err) {
        receiptUrl = "Error saving image: " + err.toString();
      }
    }

    sheet.appendRow([
      timestamp,
      data.orderId,
      data.customer.name,
      data.customer.phone,
      data.customer.email,
      data.customer.address,
      data.items,
      data.total,
      data.paymentMethod,
      data.chefNote ? data.chefNote.en : '',
      data.chefNote ? data.chefNote.zh : '',
      data.customer.coordinates ? `${data.customer.coordinates.lat}, ${data.customer.coordinates.lng}` : '',
      receiptUrl,
      'Pending', // Default Status
      data.itemsJson || '' // Items JSON
    ]);

    return ContentService.createTextOutput(JSON.stringify({ 'result': 'success', 'row': sheet.getLastRow() }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ 'result': 'error', 'error': e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Helper to convert Drive file links to direct view links (if public) or just pass through
function getDirectImageLink(url) {
  if (!url) return '';

  // 1. Check if it's a Google Drive/Docs URL
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    try {
      var id = "";
      // Match /d/ID/ or /uc?id=ID or &id=ID or /file/d/ID
      var parts = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (parts && parts[1]) {
        id = parts[1];
      } else {
        parts = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (parts && parts[1]) {
          id = parts[1];
        }
      }

      if (id) {
        // Use thumbnail link which is more reliable for embedding (w1000 = width 1000px)
        return "https://drive.google.com/thumbnail?id=" + id + "&sz=w1000";
      }
    } catch (e) {
      console.log("Error parsing Drive URL: " + url);
    }
  }

  // 2. Otherwise return the URL as is (e.g. Unsplash, other hosts)
  return url;
}


function getMenuData() {
  var doc = SpreadsheetApp.getActiveSpreadsheet();

  // --- Theme ---
  var themeSheet = doc.getSheetByName('Theme');
  if (!themeSheet) {
    themeSheet = doc.insertSheet('Theme');
    themeSheet.appendRow(['Key', 'Value (EN)', 'Value (ZH)']); // Headers
    themeSheet.appendRow(['Title', 'Nyonya Heritage Tour', '娘惹文化之旅']);
    themeSheet.appendRow(['DateRange', 'Jan 19 - Jan 23', '']);
    themeSheet.appendRow(['CutoffTime', '8:00 PM', '晚上 8:00']);
    themeSheet.appendRow(['BankName', 'Hong Leong Bank', '']);
    themeSheet.appendRow(['BankAccount', '38900171282', '']);
    themeSheet.appendRow(['AccountName', 'Sam Ai Sia', '']);
    themeSheet.appendRow(['TngPhoneNumber', '+6017-9653871', '']);
    themeSheet.appendRow(['OwnerEmail', 'thewanderingspoon@outlook.com', '']);
  }

  var themeData = themeSheet.getDataRange().getValues();
  var theme = {};
  // Skip header
  for (var i = 1; i < themeData.length; i++) {
    var key = themeData[i][0];
    if (key) {
      // Simple mapping, can be expanded
      if (key === 'Title') { theme.title = themeData[i][1]; theme.titleZh = themeData[i][2]; }
      else if (key === 'DateRange') theme.dateRange = themeData[i][1];
      else if (key === 'CutoffTime') { theme.cutoffTime = themeData[i][1]; theme.cutoffTimeZh = themeData[i][2]; }
      else if (key === 'BankName') theme.bankName = themeData[i][1];
      else if (key === 'BankAccount') theme.bankAccount = String(themeData[i][1]); // Force string
      else if (key === 'AccountName') theme.accountName = themeData[i][1];
      else if (key === 'TngPhoneNumber') theme.tngPhoneNumber = String(themeData[i][1]);
      else if (key === 'OwnerEmail') theme.ownerEmail = themeData[i][1];
      else if (key === 'DiscountRate') theme.discountRate = Number(themeData[i][1]); // Rate like 0.10 for 10%
      else if (key === 'WeeklyHeaderImage') theme.heroImage = getDirectImageLink(themeData[i][1]);
    }
  }

  // --- Inventory Calculation ---
  var soldCounts = {};
  var ordersSheet = doc.getSheetByName('Orders');
  if (ordersSheet) {
    var rawData = ordersSheet.getDataRange().getValues();
    if (rawData.length > 1) {
      var headers = rawData[0];
      var statusIdx = headers.indexOf('Status');
      var itemsJsonIdx = headers.indexOf('Items JSON');

      if (statusIdx !== -1 && itemsJsonIdx !== -1) {
        for (var k = 1; k < rawData.length; k++) {
          var status = rawData[k][statusIdx];
          var jsonStr = rawData[k][itemsJsonIdx];
          // Count Pending and Confirmed (to reserve inventory)
          if (status !== 'Rejected' && status !== 'Cancelled' && jsonStr) {
            try {
              var items = JSON.parse(jsonStr);
              if (Array.isArray(items)) {
                items.forEach(function (item) {
                  if (item.id && item.q) {
                    soldCounts[item.id] = (soldCounts[item.id] || 0) + Number(item.q);
                  }
                });
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      }
    }
  }

  // --- Menu Items ---
  var menuSheet = doc.getSheetByName('Menu');
  if (!menuSheet) {
    menuSheet = doc.insertSheet('Menu');
    menuSheet.appendRow(['Day', 'Day (ZH)', 'ID', 'Title', 'Title (ZH)', 'Description', 'Description (ZH)', 'Price', 'Image URL', 'Inventory', 'Allergens', 'Allergens (ZH)', 'Side Dishes', 'Side Dishes (ZH)', 'Story', 'Story (ZH)']);
    // You can add default data here if you want
  }

  var menuData = menuSheet.getDataRange().getValues();
  var menuItems = [];
  // Skip header, assuming proper order
  for (var i = 1; i < menuData.length; i++) {
    var row = menuData[i];
    if (row[0]) { // If Day exists
      var maxInv = Number(row[9]);
      var sold = soldCounts[row[2]] || 0;
      var remaining = Math.max(0, maxInv - sold);

      menuItems.push({
        day: row[0],
        dayZh: row[1],
        id: row[2],
        title: row[3],
        titleZh: row[4],
        description: row[5],
        descriptionZh: row[6],
        price: Number(row[7]),
        image: getDirectImageLink(row[8]),
        maxInventory: remaining, // Use calculated remaining inventory
        allergies: row[10] ? row[10].split(',').map(function (s) { return s.trim(); }) : [],
        allergiesZh: row[11] ? row[11].split(',').map(function (s) { return s.trim(); }) : [],
        sideDishes: row[12] ? String(row[12]) : '',
        sideDishesZh: row[13] ? String(row[13]) : '',
        story: row[14] ? String(row[14]) : '',
        storyZh: row[15] ? String(row[15]) : ''
      });
    }
  }

  // --- Add Ons ---
  var addOnSheet = doc.getSheetByName('AddOns');
  if (!addOnSheet) {
    addOnSheet = doc.insertSheet('AddOns');
    addOnSheet.appendRow(['ID', 'Title', 'Title (ZH)', 'Price', 'Type', 'Days']);
    addOnSheet.appendRow(['fruit', 'Seasonal Fruit Cup', '时令水果杯', 4.00, 'fruit', 'Monday, Tuesday, Wednesday, Thursday, Friday']);
    addOnSheet.appendRow(['drink', 'The Daily Infusion', '每日特饮', 5.00, 'drink', '']);
  }

  var addOnData = addOnSheet.getDataRange().getValues();
  var addOns = [];
  for (var i = 1; i < addOnData.length; i++) {
    var row = addOnData[i];
    if (row[0]) {
      addOns.push({
        id: row[0],
        title: row[1],
        titleZh: row[2],
        price: Number(row[3]),
        type: row[4],
        days: row[5] ? String(row[5]).split(',').map(function (s) { return s.trim(); }) : []
      });
    }
  }

  return {
    theme: theme,
    menuItems: menuItems,
    addOns: addOns
  };
}

function setup() {
  // Just run getMenuData, it handles creation of missing sheets
  getMenuData();
}

function debugPermissions() {
  var folder = DriveApp.createFolder("Temp_Debug_Permission_Test");
  console.log("Folder created: " + folder.getUrl());
  folder.setTrashed(true);
}
