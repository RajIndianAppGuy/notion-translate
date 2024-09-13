// require("dotenv").config();
// const { Client } = require("@notionhq/client");
// const { translate } = require("free-translate");
// const supabase = require("@supabase/supabase-js");
// const fs = require("fs");
// const path = require("path");
// const fetch = require("node-fetch");
// const crypto = require("crypto");

// // Initialize Notion and Supabase clients
// const notion = new Client({
//   auth: process.env.NOTION_API_KEY,
// });
// const supabaseClient = supabase.createClient(
//   process.env.SUPABASE_URL,
//   process.env.SUPABASE_KEY
// );

// // Translation Database IDs
// const translationDatabaseIds = {
//   fr: "0056ec4f5d06432fbe69452a040cd001",
//   es: "14a33a8556044cf5b768b570513b2dad",
//   de: "25a22666a54a430081f6e0ab3c340f82",
//   it: "10043bee00728068a565d23cb6e7871c",
// };
// const sourceDatabaseID = "0b660fa5403349cf8fa2de5a49fd275f";

// // Helper: Generate a random alphanumeric string
// const generateAlphanumeric = (length) => {
//   return crypto.randomBytes(length).toString("hex");
// };

// // Helper: Translate text
// const translateText = async (text, targetLanguage) => {
//   if (!text) return "";
//   console.log(`Translating text to ${targetLanguage}: ${text}`);

//   return await translate(text, { from: "en", to: targetLanguage });
// };

// // Helper: Download an image
// const downloadImage = async (url, outputPath, retries = 3, delay = 2000) => {
//   console.log(`Downloading image from URL: ${url}`);
//   const localImagePath = path.resolve(outputPath);

//   for (let attempt = 1; attempt <= retries; attempt++) {
//     try {
//       const response = await fetch(url);
//       if (!response.ok) {
//         throw new Error(`Failed to fetch image: ${response.statusText}`);
//       }

//       const fileStream = fs.createWriteStream(localImagePath);
//       return new Promise((resolve, reject) => {
//         response.body.pipe(fileStream);
//         response.body.on("error", (err) => reject(err));
//         fileStream.on("finish", () => {
//           console.log(`Image downloaded and saved at: ${localImagePath}`);
//           resolve(localImagePath);
//         });
//       });
//     } catch (error) {
//       console.error(
//         `Attempt ${attempt} - Error downloading image: ${error.message}`
//       );
//       if (attempt < retries) {
//         console.log(`Retrying in ${delay / 1000} seconds...`);
//         await new Promise((resolve) => setTimeout(resolve, delay));
//       } else {
//         throw new Error(`Failed to download image after ${retries} attempts`);
//       }
//     }
//   }
// };

// // Helper: Upload an image to Supabase
// const uploadToSupabase = async (filePath, fileName) => {
//   console.log(`Uploading ${fileName} to Supabase...`);
//   const fileBuffer = fs.readFileSync(filePath);
//   const { error, data } = await supabaseClient.storage
//     .from("ppt")
//     .upload(fileName, fileBuffer, { contentType: "image/jpeg" });

//   if (error) {
//     throw new Error("Error uploading to Supabase: " + error.message);
//   }
//   console.log(`Uploaded image available at: ${data.publicUrl}`);
//   return data.publicUrl;
// };

// // Helper: Format Notion blocks
// const formatBlock = (block) => {
//   if (block.type === "image") {
//     return block.image.file
//       ? { type: "file", url: block.image.file.url }
//       : { type: "external", url: block.image.external.url };
//   }
//   const richTextArray = block[block.type]?.rich_text || [];
//   return richTextArray.map((richText) => richText.plain_text).join("");
// };

// // Helper: Process an individual row and translate it sequentially
// const processPageSequentially = async (row) => {
//   for (const [languageKey, databaseId] of Object.entries(
//     translationDatabaseIds
//   )) {
//     try {
//       // Translate title and description
//       const translatedName = await translateText(
//         row.properties.Name.title[0].text.content,
//         languageKey
//       );
//       const translatedDesc = await translateText(
//         row.properties.Desc.rich_text[0].text.content,
//         languageKey
//       );

//       // Create a page in the translation database
//       const response = await notion.pages.create({
//         parent: { database_id: databaseId },
//         properties: { Published: { checkbox: true } },
//       });
//       const destinationPageId = response.id;

//       // Update the newly created page with translated content
//       await notion.pages.update({
//         page_id: destinationPageId,
//         properties: {
//           Name: { title: [{ text: { content: translatedName } }] },
//           Desc: { rich_text: [{ text: { content: translatedDesc } }] },
//         },
//       });

//       console.log(
//         `Translated page created in ${languageKey} with ID: ${destinationPageId}`
//       );

//       // Fetch and translate blocks (e.g., images, text blocks)
//       const blocks = await notion.blocks.children.list({ block_id: row.id });
//       const childrenToAppend = [];

//       for (const block of blocks.results) {
//         const blockType = block.type;
//         if (blockType === "image") {
//           const imageDetails = formatBlock(block);
//           const imageFileName = `image_${generateAlphanumeric(10)}.jpg`;
//           const localImagePath = path.join(__dirname, imageFileName);

//           // Download and upload the image
//           await downloadImage(imageDetails.url, localImagePath);
//           const supabaseUrl = await uploadToSupabase(
//             localImagePath,
//             imageFileName
//           );

//           // Collect the image block
//           childrenToAppend.push({
//             object: "block",
//             type: "image",
//             image: { type: "external", external: { url: supabaseUrl } },
//           });

//           // Remove local image
//           await fs.promises.unlink(localImagePath);
//         } else {
//           // Translate text blocks
//           const originalText = formatBlock(block);
//           const translatedText = await translateText(originalText, languageKey);
//           if (translatedText) {
//             childrenToAppend.push({
//               object: "block",
//               type: blockType,
//               [blockType]: {
//                 rich_text: [{ text: { content: translatedText } }],
//               },
//             });
//           }
//         }
//       }

//       // Append blocks to the translated page
//       if (childrenToAppend.length > 0) {
//         await notion.blocks.children.append({
//           block_id: destinationPageId,
//           children: childrenToAppend,
//         });
//         console.log("Blocks appended successfully.");
//       }
//       console.log(`Page translated successfully to ${languageKey}`);
//     } catch (err) {
//       console.error(`Error processing page in ${languageKey}: ${err.message}`);
//     }
//   }
// };

// // Main function to process all rows in the database sequentially
// (async function main() {
//   try {
//     let rows = await notion.databases.query({ database_id: sourceDatabaseID });
//     rows = rows.results
//       .filter((row) => row.properties.Published?.checkbox === true)
//       .slice(0, 5);

//     for (let row of rows) {
//       await processPageSequentially(row);
//     }
//   } catch (error) {
//     console.error("Critical error:", error.message);
//   }
// })();

const { translate } = require("free-translate");

(async () => {
  const translatedText = await translate("Hello World", {
    from: "en",
    to: "ja",
  });

  console.log(translatedText); // こんにちは世界
})();
