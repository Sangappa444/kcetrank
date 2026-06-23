const nodemailer = require('nodemailer');

// Ensure you configure these in your .env file
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can use other services or SMTP details here
    auth: {
        user: process.env.EMAIL_USER || 'test@example.com',
        pass: process.env.EMAIL_PASS || 'dummy-password'
    }
});

const sendPDFEmail = async (toEmail, pdfBuffer) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER || 'Vidyari Platform <test@example.com>',
            to: toEmail,
            subject: 'Your Vidyari KCET Option Entry PDF Report',
            text: 'Hello!\n\nThank you for using Vidyari. Please find your mathematically optimized Option Entry PDF report attached.\n\nBest of luck with your counseling!\n- The Vidyari Team',
            attachments: [
                {
                    filename: 'Vidyari_Option_Entry_Report.pdf',
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('[EmailService] PDF sent successfully: ' + info.response);
        return { success: true };
    } catch (error) {
        console.error('[EmailService] Error sending PDF: ', error);
        return { success: false, error: error.message };
    }
};

module.exports = { sendPDFEmail };
