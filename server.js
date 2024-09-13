require("dotenv").config();
const express = require("express");
const { Client } = require("@notionhq/client");
const { translate } = require("free-translate");
const supabase = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const crypto = require("crypto");

const app = express();
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const supabaseClient = supabase.createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const generateAlphanumeric = (length) => {
  return crypto.randomBytes(length).toString("hex");
};

const downloadImage = async (url, outputPath, retries = 3, delay = 2000) => {
  console.log(`Downloading image from URL: ${url}`);
  const localImagePath = path.resolve(outputPath);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const fileStream = fs.createWriteStream(localImagePath);

      return new Promise((resolve, reject) => {
        response.body.pipe(fileStream);
        response.body.on("error", (err) => {
          reject(err);
        });
        fileStream.on("finish", () => {
          console.log(`Image downloaded and saved at: ${localImagePath}`);
          resolve(localImagePath);
        });
      });
    } catch (error) {
      console.error(
        `Attempt ${attempt} - Error downloading image: ${error.message}`
      );

      if (attempt < retries) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw new Error(`Failed to download image after ${retries} attempts`);
      }
    }
  }
};

app.get("/translate-and-duplicate-page", async function (req, res) {
  const translationDatabaseIds = [
    {
      fr: "0056ec4f5d06432fbe69452a040cd001",
    },
    { es: "14a33a8556044cf5b768b570513b2dad" },
    // de: "25a22666a54a430081f6e0ab3c340f82",
    // it: "10043bee00728068a565d23cb6e7871c",
    // pt: "10043bee0072807ca931c8c80212b3f3",
    // ko: "8d00530810bb4ba2b56ebe5337c0c4b7",
  ];
  const sourceDatabaseID = "0b660fa5403349cf8fa2de5a49fd275f";

  try {
    let rows = await notion.databases.query({
      database_id: sourceDatabaseID,
    });

    rows = rows.results
      .filter((row) => row.properties.Published?.checkbox === true)
      .slice(0, 5);

    let successMessages = [];
    let errorMessages = [];

    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < translationDatabaseIds.length; j++) {
        const row = rows[i];
        const translateText = async (text) => {
          if (!text) return "";
          console.log(`Translating text: ${text}`);
          return await translate(text, {
            from: "en",
            to: `${Object.keys(translationDatabaseIds[j])[0]}`,
          });
        };
        try {
          const response = await notion.pages.create({
            parent: {
              database_id: Object.values(translationDatabaseIds[j])[0],
            },
            properties: {
              Published: {
                checkbox: true,
              },
            },
          });

          const destinationPageId = response.id;
          let {
            Name,
            Published,
            Date,
            Slug,
            Desc,
            Tags,
            OGimage,
            keywords,
            Category,
            ContainsTOC,
            FilesAndMedia,
          } = row.properties;

          const AuthorSlug = row.properties["Author Slug"];

          let translatedName = await translateText(Name.title[0].text.content);
          let translatedDesc = await translateText(
            Desc.rich_text[0].text.content
          );

          await notion.pages.update({
            page_id: destinationPageId,
            properties: {
              Name: {
                title: [
                  {
                    text: {
                      content: translatedName,
                    },
                  },
                ],
                id: Name?.id,
              },
              Published: Published
                ? {
                    checkbox: Published.checkbox,
                    id: Published.id,
                  }
                : undefined,
              Date: Date?.date
                ? {
                    date: {
                      start: Date.date.start,
                    },
                    id: Date.id,
                  }
                : undefined,
              Slug: {
                rich_text: [
                  {
                    text: {
                      content: Slug?.rich_text?.[0]?.text?.content || "",
                    },
                  },
                ],
                id: Slug?.id,
              },
              Desc: {
                rich_text: [
                  {
                    text: {
                      content: translatedDesc,
                    },
                  },
                ],
                id: Desc?.id,
              },
              Tags: Tags?.multi_select
                ? {
                    multi_select: Tags.multi_select.map((tag) => ({
                      name: tag.name,
                    })),
                    id: Tags?.id,
                  }
                : undefined,
              OGimage:
                OGimage?.id && OGimage?.url
                  ? {
                      id: OGimage.id,
                      url: OGimage.url,
                    }
                  : undefined,
              keywords: keywords?.multi_select
                ? {
                    multi_select: keywords.multi_select.map((tag) => ({
                      name: tag.name,
                    })),
                    id: keywords?.id,
                  }
                : undefined,
              Category: {
                select: {
                  name: Category?.select?.name || "",
                },
                id: Category?.id,
              },
              ContainsTOC: ContainsTOC
                ? {
                    checkbox: ContainsTOC.checkbox,
                    id: ContainsTOC?.id,
                  }
                : undefined,
              "Author Slug":
                AuthorSlug?.id && AuthorSlug?.select
                  ? {
                      id: AuthorSlug.id,
                      select: {
                        name: AuthorSlug?.select?.name || "",
                      },
                    }
                  : undefined,
              FilesAndMedia: FilesAndMedia?.files
                ? {
                    files: FilesAndMedia.files.map((file) => ({
                      name: file.name,
                      type: file.type,
                      file: file.file,
                    })),
                    id: FilesAndMedia?.id,
                  }
                : undefined,
            },
          });

          console.log(
            `Destination page updated successfully. in ${
              Object.keys(translationDatabaseIds[j])[0]
            } for pageId ${Object.values(translationDatabaseIds[j])[0]}`
          );

          const blocks = await notion.blocks.children.list({
            block_id: row.id,
          });

          const formatBlock = (block) => {
            if (block.type === "image") {
              return block.image.file
                ? { type: "file", url: block.image.file.url }
                : { type: "external", url: block.image.external.url };
            }

            const richTextArray = block[block.type]?.rich_text || [];
            const text = richTextArray
              .map((richText) => richText.plain_text)
              .join("");
            return text;
          };

          const uploadToSupabase = async (filePath, fileName) => {
            console.log(`Uploading ${fileName} to Supabase...`);
            const fileBuffer = fs.readFileSync(filePath);
            const { error } = await supabaseClient.storage
              .from("ppt")
              .upload(fileName, fileBuffer, {
                contentType: "image/jpeg",
              });

            if (error) {
              throw new Error("Error uploading to Supabase: " + error.message);
            }

            const { data } = supabaseClient.storage
              .from("ppt")
              .getPublicUrl(fileName);

            if (error) {
              console.error("Error getting public URL:", error.message);
            } else {
              console.log(`Uploaded image available at: ${data.publicUrl}`);
              return data.publicUrl;
            }
          };

          let childrenToAppend = [];

          for (const block of blocks.results) {
            const blockType = block.type;

            if (blockType === "image") {
              const imageDetails = formatBlock(block);
              console.log(`Processing image block: ${imageDetails.url}`);

              // Generate random alphanumeric string for image name
              const imageFileName = `image_${generateAlphanumeric(10)}.jpg`;
              const localImagePath = path.join(__dirname, imageFileName);

              // Download and upload image
              await downloadImage(imageDetails.url, localImagePath);
              const supabaseUrl = await uploadToSupabase(
                localImagePath,
                imageFileName
              );

              // Collect image block to append later
              childrenToAppend.push({
                object: "block",
                type: "image",
                image: {
                  type: "external",
                  external: {
                    url: supabaseUrl,
                  },
                },
              });

              // Remove the local image after processing
              await fs.promises.unlink(localImagePath);
              console.log("Local image file removed after processing.");
              continue; // Skip text translation for image blocks
            }

            const originalText = formatBlock(block);
            const translatedText = await translateText(originalText);

            console.log("translated text: ", translatedText);

            if (translatedText) {
              childrenToAppend.push({
                object: "block",
                type: blockType,
                [blockType]: {
                  rich_text: [
                    {
                      type: "text",
                      text: {
                        content: translatedText,
                      },
                    },
                  ],
                },
              });
            }
          }

          if (childrenToAppend.length > 0) {
            console.log(
              "Appending all collected blocks to destination page..."
            );
            await notion.blocks.children.append({
              block_id: destinationPageId,
              children: childrenToAppend,
            });
            console.log("All blocks appended successfully.");
          }

          successMessages.push(
            `Page ${destinationPageId} translated successfully to ${
              Object.keys(translationDatabaseIds[j])[0]
            }`
          );
        } catch (err) {
          console.error("Error during processing:", err.message);
          errorMessages.push(
            `Failed to process row ${i} for translation ${j}: ${err.message}`
          );
        }
      }
    }
    res.status(200).json({
      message: "success",
      successMessages: successMessages,
      errorMessages: errorMessages,
    });
  } catch (error) {
    console.error("Critical error:", error);
    res.status(500).json({
      message: "error",
      error: error.message,
    });
  }
});

app.get("/get-page-rows-children", async function (req, res) {
  const pageId = "0b660fa5403349cf8fa2de5a49fd275f"; // The ID of the database

  try {
    console.log("Fetching rows for page ID:", pageId);

    // Fetch the rows (database query)
    const notionResponse = await notion.databases.query({
      database_id: pageId,
    });

    const rows = notionResponse.results
      .filter((row) => row.properties.Published?.checkbox === true)
      .slice(0, 5); // Limit to 5 rows
    let allChildren = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      allChildren.push(row);
    }

    console.log("Successfully fetched and processed the first 5 rows.");

    res.json({
      message: "success",
      rows: allChildren,
    });
  } catch (error) {
    console.error("Error fetching rows:", error);
    res.status(500).json({
      message: "error",
      error: error.message,
    });
  }
});

const listener = app.listen(1000, function () {
  console.log("Your app is listening on port " + listener.address().port);
});
