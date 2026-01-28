function getDashboardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const consumerSheet = ss.getSheetByName('ConsumerDetails');
  const followUpSheet = ss.getSheetByName('ConsumerFollowUp');

  // Fetch consumer data
  const consumerData = consumerSheet
    .getDataRange()
    .getValues()
    .slice(1)
    .map((row) => ({
      name: row[0],
      address: row[1],
      mobileNo: row[2],
      email: row[3],
      age: row[4],
      gender: row[5],
    }));

  // Calculate total number of consumers
  const totalConsumers = consumerData.length;

  // Fetch follow-up stats
  const followUps = followUpSheet.getDataRange().getValues().slice(1);
  const followUpStats = followUps.reduce((acc, row) => {
    // Ensure row[4] is processed correctly
    const dateCell = row[4];
    let dateString = '';

    if (dateCell instanceof Date) {
      // Convert Date object to string in dd/mm/yyyy format
      const day = dateCell.getDate().toString().padStart(2, '0');
      const month = (dateCell.getMonth() + 1).toString().padStart(2, '0');
      const year = dateCell.getFullYear();
      dateString = `${day}/${month}/${year}`;
    } else if (typeof dateCell === 'string') {
      // Use existing string if it's already in dd/mm/yyyy format
      dateString = dateCell.split(' ')[0];
    } else {
      // Handle unexpected types
      dateString = 'Unknown';
    }

    acc[dateString] = (acc[dateString] || 0) + 1;
    return acc;
  }, {});

  // Fetch message modes
  const messageModes = followUps.reduce((acc, row) => {
    const mode = row[6]; // Assuming the "messagesentmode" is in the 7th column
    acc[mode] = (acc[mode] || 0) + 1;
    return acc;
  }, {});

  // Fetch message counts by user
  const messageCounts = followUps.reduce((acc, row) => {
    const user = row[5]; // Assuming the "User" is in the 6th column
    acc[user] = (acc[user] || 0) + 1;
    return acc;
  }, {});

  // Format the message counts
  const messageCountsData = {
    labels: Object.keys(messageCounts),
    data: Object.values(messageCounts),
  };

  // Format follow-up stats and message modes for the chart
  return {
    consumers: consumerData,
    totalConsumers: totalConsumers,
    followUpStats: {
      labels: Object.keys(followUpStats), // Days will be used as labels
      data: Object.values(followUpStats), // Corresponding follow-up count
    },
    messageModes: {
      labels: Object.keys(messageModes),
      data: Object.values(messageModes),
    },
    messageCounts: messageCountsData,
  };
}

function getUserDashboardData(userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const followUpSheet = ss.getSheetByName('ConsumerFollowUp');
  const followUps = followUpSheet.getDataRange().getValues().slice(1);

  // Filter follow-ups for the logged-in user
  const userFollowUps = followUps.filter((row) => row[5] === userId);

  // Follow-Up Stats by Day
  const followUpStats = userFollowUps.reduce((acc, row) => {
    const dateCell = row[4];
    const dateString =
      dateCell instanceof Date
        ? `${dateCell.getDate().toString().padStart(2, '0')}/${(dateCell.getMonth() + 1).toString().padStart(2, '0')}/${dateCell.getFullYear()}`
        : typeof dateCell === 'string'
          ? dateCell.split(' ')[0]
          : 'Unknown';

    acc[dateString] = (acc[dateString] || 0) + 1;
    return acc;
  }, {});

  // Message Modes
  const messageModes = userFollowUps.reduce((acc, row) => {
    const mode = row[6];
    acc[mode] = (acc[mode] || 0) + 1;
    return acc;
  }, {});

  // Total Messages
  const totalMessages = userFollowUps.length;

  return {
    followUpStats: {
      labels: Object.keys(followUpStats),
      data: Object.values(followUpStats),
    },
    messageModes: {
      labels: Object.keys(messageModes),
      data: Object.values(messageModes),
    },
    totalMessages: totalMessages,
  };
}

function uploadFile(base64Data, fileName) {
  if (!base64Data || base64Data.trim() === '') {
    console.warn('No valid image data provided. Skipping upload.');
    return null; // Return null instead of throwing an error
  }

  // Check if the input is already a URL (existing image)
  if (typeof base64Data === 'string' && base64Data.startsWith('https://')) {
    return base64Data; // Return the same URL if no new upload is needed
  }

  // Use a fixed folder ID (to avoid creating multiple folders)
  const folder = getOrCreateFolder('CustomerImageFolder');
  //const folder = DriveApp.getFolderById("<Folder id >");

  // Process Base64 data for a new image
  const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/jpeg', fileName);
  const file = folder.createFile(blob);

  // Set sharing permission
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Return thumbnail URL
  return `https://drive.google.com/thumbnail?id=${file.getId()}`;
}

function getOrCreateFolder(folderName) {
  const properties = PropertiesService.getScriptProperties();
  const folderId = properties.getProperty(folderName);

  if (folderId) {
    const folder = DriveApp.getFolderById(folderId);
    if (folder) return folder; // Return existing folder
  }

  // If no stored folder ID, check manually in root
  const rootFolder = DriveApp.getRootFolder();
  const folders = rootFolder.getFoldersByName(folderName);

  let folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = rootFolder.createFolder(folderName);
  }

  // Store the folder ID to prevent duplicates
  properties.setProperty(folderName, folder.getId());
  return folder;
}

function submitForm(formData) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const reportSheet = spreadsheet.getSheetByName('ConsumerDetails');
  const images = formData.images || []; // Array of new image URLs
  const oldImages = formData.oldImages || []; // Array of old image URLs to delete

  if (formData.rowIndex) {
    const rowIndex = parseInt(formData.rowIndex);

    // **DELETE CASE**
    if (formData.rowIndex.toLowerCase().includes('del')) {
      // Get row data
      const lastColumn = reportSheet.getLastColumn();
      const rowData = reportSheet.getRange(rowIndex + 1, 1, 1, lastColumn).getValues()[0];

      // Delete images from Drive
      deleteImages(oldImages);

      // Remove row from ConsumerDetails
      reportSheet.deleteRow(rowIndex + 1);

      return 'deleted';
    }
    // **UPDATE CASE**
    else {
      const lastColumn = reportSheet.getLastColumn(); // Get the actual number of columns
      const range = reportSheet.getRange(rowIndex + 1, 1, 1, lastColumn);
      const rowData = [
        formData.name,
        formData.address,
        formData.mobileno,
        formData.email,
        formData.age,
        formData.gender,
        formData.userid,
      ];

      // Ensure rowData has the same length as the range
      while (rowData.length < lastColumn) {
        rowData.push(''); // Fill with empty values if needed
      }

      range.setValues([rowData]);

      // Delete old images before updating new ones
      deleteImages(oldImages);

      // Insert new images
      images.forEach((imageUrl, index) => {
        const colIndex = 8 + index;
        reportSheet
          .getRange(rowIndex + 1, colIndex)
          .setFormula(`=IMAGE("${imageUrl}", 4, 200, 200)`);
      });

      return 'updated';
    }
  }
  // **INSERT CASE**
  else {
    const rowIndex = reportSheet.getLastRow() + 1;
    const rowData = [
      formData.name,
      formData.address,
      formData.mobileno,
      formData.email,
      formData.age,
      formData.gender,
      formData.userid,
    ];

    reportSheet.appendRow(rowData);

    // Insert new images
    images.forEach((imageUrl, index) => {
      const colIndex = 8 + index;
      reportSheet.getRange(rowIndex, colIndex).setFormula(`=IMAGE("${imageUrl}", 4, 200, 200)`);
    });

    return 'inserted';
  }
}

function deleteImages(oldImages) {
  if (!oldImages || oldImages.length === 0) {
    return;
  }

  oldImages.forEach((imageUrl) => {
    try {
      const fileIdMatch = imageUrl.match(/id=([a-zA-Z0-9_-]+)/);
      if (fileIdMatch) {
        const fileId = fileIdMatch[1];
        const file = DriveApp.getFileById(fileId);
        file.setTrashed(true);
        console.log(`Deleted image with ID: ${fileId}`);
      } else {
        console.log(`Invalid image URL: ${imageUrl}`);
      }
    } catch (error) {
      console.error(`Error deleting image: ${error.message}`);
    }
  });
}

function getConsumerData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ConsumerDetails');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  return data.map((row, index) => ({
    name: row[0],
    address: row[1],
    mobileno: row[2],
    email: row[3],
    age: row[4],
    gender: row[5],
    imageUrls: extractAllImageUrls(sheet, index + 2, 7), // Adjust for header row
  }));
}

function extractAllImageUrls(sheet, rowIndex, startColumnIndex) {
  const urls = [];
  for (let i = startColumnIndex; i < startColumnIndex + 3; i++) {
    const url = extractImageUrl(sheet, rowIndex, i);
    if (url) urls.push(url);
  }
  return urls;
}

function getConsumerRecord(rowIndex) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ConsumerDetails');
  const row = sheet.getRange(rowIndex + 1, 1, 1, 9).getValues()[0];

  const imageUrls = extractAllImageUrls(sheet, rowIndex + 1, 7);

  return {
    name: row[0],
    address: row[1],
    mobileno: row[2],
    email: row[3],
    age: row[4],
    gender: row[5],
    imageUrls: imageUrls,
  };
}

function extractImageUrl(sheet, rowIndex, columnIndex) {
  const formula = sheet.getRange(rowIndex, columnIndex).getFormula();

  // Check if the cell has a formula
  if (formula) {
    const match = formula.match(/=IMAGE\("([^"]+)"(?:,.*)?\)/i);
    if (match) {
      return match[1]; // Return the URL inside the IMAGE formula
    }
  }

  // If no formula, check if the cell has a plain URL (via getValue())
  const value = sheet.getRange(rowIndex, columnIndex).getValue();
  if (typeof value === 'string' && value.startsWith('http')) {
    return value; // Return plain URL if present
  }

  // If neither formula nor plain URL, return empty or a default value
  return '';
}

function imageBase64Urls(images) {
  try {
    return images.map((imageUrl) => {
      const response = UrlFetchApp.fetch(imageUrl);
      const blob = response.getBlob();
      const base64String = Utilities.base64Encode(blob.getBytes());
      const mimeType = blob.getContentType();
      return `data:${mimeType};base64,${base64String}`;
    });
  } catch (error) {
    console.error(`Error fetching or converting images: ${error.message}`);
    return [];
  }
}

function getFollowUps(mobileno, email) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ConsumerFollowUp');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // Remove headers

  const result = data
    .filter(
      (row) =>
        row[0]?.toString().trim() === mobileno?.toString().trim() ||
        row[1]?.toString().trim().toLowerCase() === email?.toString().trim().toLowerCase(),
    )
    .map((row) => ({
      mobileno: row[0],
      email: row[1],
      message: row[2],
      response: row[3],
      date: formatDate(row[4]), // Format date
      user: row[5],
      messagemode: row[6],
    }));

  return result;
}

function formatDate(sheetDate) {
  if (!sheetDate) return '';
  const date = new Date(sheetDate);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function sendEmail(email, messageContent, messagemode, user, mobileNo) {
  GmailApp.sendEmail(email, 'Follow-Up Message', '', {
    htmlBody: messageContent,
  });
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ConsumerFollowUp');
  sheet.appendRow([mobileNo, email, messageContent, '', new Date(), user, messagemode]);
  return 'Email sent';
}

function saveMessage(mobileNo, messageContent, messagemode, response, user, email) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ConsumerFollowUp');
  sheet.appendRow([mobileNo, email, messageContent, response, new Date(), user, messagemode]);
  return 'Message and response saved';
}
