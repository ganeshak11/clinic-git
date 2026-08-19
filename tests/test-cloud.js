const cloudinary = require('cloudinary').v2;
require('dotenv').config({ path: '.env.local' });
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const fs = require('fs');
const buffer = fs.readFileSync("package.json");
cloudinary.uploader.upload_stream(
  { resource_type: "auto", folder: "clinic-git-reports" },
  (error, result) => {
    if (error) console.error("Fail:", error);
    else console.log("Success:", result.secure_url);
  }
).end(buffer);
