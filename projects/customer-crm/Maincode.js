function doGet(e) {
  try {
    const page = e.parameter.page;
    let template;

    if (!page || page === 'login') {
      template = HtmlService.createTemplateFromFile('login');
    } else {
      template = HtmlService.createTemplateFromFile(page);
    }

    template.urllink = ScriptApp.getService().getUrl().replace('/dev', '/exec');
    template.currentpage = page || null;

    return template
      .evaluate()
      .setTitle(page || 'Login')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    console.error(`doGet error: ${error.message}`);
    return HtmlService.createHtmlOutput(`<h1>Error</h1><p>${error.message}</p>`);
  }
}

/**
 * Check login from Google Sheets
 *
 * @param {string} email - User email
 * @param {string} password - Plain text password
 * @return {Object} Login result
 */
function checkLogin(email, password) {
  // Input validation
  if (!email || !password) {
    return { success: false, message: 'Email and password required' };
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const [userEmail, userPassword, role, allowedPagesStr, username, status] = data[i];

      if (userEmail === email && String(userPassword) === password) {
        const allowedPages = allowedPagesStr ? allowedPagesStr.split(',') : [];
        return {
          success: true,
          role,
          username,
          emailid: userEmail,
          status,
          pages: allowedPages,
        };
      }
    }

    return { success: false, message: 'Invalid email or password' };
  } catch (error) {
    console.error(`Login error: ${error.message}`);
    return { success: false, message: 'Login failed' };
  }
}

// Include files
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Get all users
 *
 * @return {Array} Array of user objects
 */
function getUsers() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();

    const users = [];
    for (let i = 1; i < data.length; i++) {
      const [email, password, role, allowedPages, name, status] = data[i];
      users.push({
        email,
        password,
        role,
        allowedPages,
        name,
        status,
      });
    }
    return users;
  } catch (error) {
    console.error(`getUsers error: ${error.message}`);
    throw error;
  }
}

/**
 * Update user details
 *
 * @param {string} email - User email
 * @param {string} allowedPages - Comma-separated allowed pages
 * @param {string} name - User name
 * @param {string} status - User status
 * @return {Object} Result message
 */
function updateUserDetails(email, allowedPages, name, status) {
  // Input validation
  if (!email) {
    return { message: 'Email is required' };
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === email) {
        sheet.getRange(i + 1, 4).setValue(allowedPages); // Column D (Allowed Pages)
        sheet.getRange(i + 1, 5).setValue(name); // Column E (Name)
        sheet.getRange(i + 1, 6).setValue(status); // Column F (Status)
        return { message: 'User details updated successfully!' };
      }
    }

    return { message: 'User not found!' };
  } catch (error) {
    console.error(`updateUserDetails error: ${error.message}`);
    return { message: 'Update failed' };
  }
}

/**
 * Get user by email
 *
 * @param {string} email - User email
 * @return {Object|null} User object or null
 */
function getUserByEmail(email) {
  if (!email) {
    return null;
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === email) {
        return {
          email: data[i][0],
          name: data[i][4],
        };
      }
    }

    return null;
  } catch (error) {
    console.error(`getUserByEmail error: ${error.message}`);
    return null;
  }
}

/**
 * Change user password
 *
 * @param {string} email - User email
 * @param {string} currentPassword - Current password (plain text)
 * @param {string} newPassword - New password (plain text)
 * @return {Object} Result with success status and message
 */
function changeUserPassword(email, currentPassword, newPassword) {
  // Input validation
  if (!email || !currentPassword || !newPassword) {
    return { success: false, message: 'All fields are required' };
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const [userEmail, userPassword] = data[i];

      if (userEmail === email) {
        if (String(userPassword) !== currentPassword) {
          return { success: false, message: 'Incorrect current password!' };
        }

        sheet.getRange(i + 1, 2).setValue(newPassword); // Column B (Password)
        return { success: true, message: 'Password changed successfully!' };
      }
    }

    return { success: false, message: 'User not found!' };
  } catch (error) {
    console.error(`Password change error: ${error.message}`);
    return { success: false, message: 'Password change failed' };
  }
}
