# Google Apps Script Update Required

To enable real-time order status updates, you need to update your Google Apps Script (in the Google Sheet Extensions > Apps Script) to handle the `getOrderStatus` request.

## Update `doGet` function

Locate your existing `doGet` function and update it to handle the `orderId` parameter. It should look something like this:

```javascript
function doGet(e) {
  // Check if we are checking order status
  if (e.parameter.orderId) {
    return checkOrderStatus(e.parameter.orderId);
  }

  // Otherwise return the menu data (existing logic)
  return getMenuData();
}

function checkOrderStatus(orderId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders'); // Ensure sheet name matches
  var data = sheet.getDataRange().getValues();
  
  // Assume Row 1 is headers. Find 'Order ID' and 'Status' columns.
  var headers = data[0];
  var idIndex = headers.indexOf('Order ID'); // Update column name if different
  var statusIndex = headers.indexOf('Status'); // Update column name if different

  if (idIndex === -1 || statusIndex === -1) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Columns not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Search for the order
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) === String(orderId)) {
      var status = data[i][statusIndex];
      return ContentService.createTextOutput(JSON.stringify({ status: status }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "NotFound" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ... your existing getMenuData and doPost functions ...
```

**Important**:
1.  Ensure the Sheet name `'Orders'` matches your actual sheet name.
2.  Ensure the column headers `'Order ID'` and `'Status'` match exactly.
3.  Deploy the script again as a **Web App** (Select 'New deployment' -> Version 'New' -> Deploy) to apply changes.
