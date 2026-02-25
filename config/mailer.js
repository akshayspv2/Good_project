const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'your.email@gmail.com',
    pass: 'yourpassword'
  }
});

exports.sendResetEmail = async (to, link) => {
  const mailOptions = {
    from: '"ChargeNow Support" <your.email@gmail.com>',
    to,
    subject: 'Password Reset',
    html: `<p>Click the link to reset your password:</p><a href="${link}">${link}</a>`
  };

  await transporter.sendMail(mailOptions);
};
