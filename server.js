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
      ko: "8d00530810bb4ba2b56ebe5337c0c4b7",
    },
    { es: "14a33a8556044cf5b768b570513b2dad" },
    // de: "25a22666a54a430081f6e0ab3c340f82",
    // it: "10043bee00728068a565d23cb6e7871c",
    // pt: "10043bee0072807ca931c8c80212b3f3",
    // ko: "8d00530810bb4ba2b56ebe5337c0c4b7",
  ];
  const sourceDatabaseID = "0b660fa5403349cf8fa2de5a49fd275f";

  try {
    let allRows = [];
    let hasMore = true;
    let startCursor = undefined; // Start without a cursor

    // Loop to fetch all rows using pagination
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: sourceDatabaseID,
        start_cursor: startCursor, // This will be `undefined` on the first call
      });

      // Concatenate the results with allRows
      allRows = allRows.concat(response.results);

      // Check if there are more rows to fetch
      hasMore = response.has_more;
      startCursor = response.next_cursor; // Set the next cursor for pagination
    }
    const blogs = [
      {
        slug: "how-to-use-chatgpt-for-powerpoint-presentations",
        pageId: "3acc81af-083e-4333-8716-e9270e544d69",
      },
      {
        slug: "how-to-upload-fonts-to-google-slides",
        pageId: "eb6a944e-c791-4b38-b6df-63845f4b46e2",
      },
      {
        slug: "how-to-convert-pdf-to-ppt-using-ai",
        pageId: "59ad7a58-dd3f-4343-a0b7-f38a58423df8",
      },
      {
        slug: "how-to-play-powerpoint-slides-automatically-without-clicking",
        pageId: "1c478cfb-48b5-4fa1-939c-a272d8193894",
      },
      {
        slug: "how-to-change-opacity-in-google-slides",
        pageId: "bc737a0e-a4bb-46f5-8c31-14fa09fd12bf",
      },
      {
        slug: "how-to-download-an-image-from-google-slides",
        pageId: "e7767991-00f0-44f9-935d-4db44ecf6d74",
      },
      {
        slug: "how-to-use-google-form-autofill-bot",
        pageId: "e8761b16-0587-4e24-9f28-52059095a6ef",
      },
      {
        slug: "how-to-delete-slack-conversation-history",
        pageId: "fad00f9b-5306-43a3-9b9f-b7c247bad411",
      },
      {
        slug: "How-to-automatically-play-google-slides",
        pageId: "20657a2a-daf7-4d21-8e98-711ab1a2ef09",
      },
      {
        slug: "how-to-add-a-timer-to-powerpoint",
        pageId: "6e7a7fe7-3c62-4961-8419-adfc2a51a8ca",
      },
      {
        slug: "how-to-recover-an-unsaved-powerpoint",
        pageId: "e23dfeaa-b5c7-4ec3-bbae-310aa3de76d8",
      },
      {
        slug: "outline-text-in-google-slides",
        pageId: "f6b556d6-af0d-49f4-ad65-2ce528436511",
      },
      {
        slug: "how-to-convert-pdf-to-google-slides",
        pageId: "43c9c984-4d72-40cb-88f1-57e99f673d42",
      },
      {
        slug: "how-to-view-submitted-google-forms",
        pageId: "684338e3-83ec-4518-964d-f80adb36c83a",
      },
      {
        slug: "how-to-see-google-forms-you-filled-out",
        pageId: "3fe5be02-49e7-4928-b165-412b9a8e88c9",
      },
      {
        slug: "how-to-insert-equations-in-google-slides",
        pageId: "88a3ef57-96ce-4cde-8c28-a60e1b664425",
      },
      {
        slug: "how-to-change-opacity-in-powerpoint",
        pageId: "8e4c7700-4e94-4f0d-a5e7-cc1e924a6425",
      },
      {
        slug: "how-to-format-google-docs-like-a-booklet",
        pageId: "7a430306-e484-44b7-8c6a-9b506dea9831",
      },
      {
        slug: "how-to-see-google-forms-you-submitted",
        pageId: "f857542a-0dc4-40ca-b229-4b1c1a809801",
      },
      {
        slug: "how-to-convert-a-canva-presentation-to-google-slides",
        pageId: "06ea32d9-cd18-4251-ba5c-c642620b2246",
      },
      {
        slug: "how-to-fade-a-picture-in-powerpoint",
        pageId: "e92e12c0-1d73-40e4-8094-1c4ca779fe50",
      },
      {
        slug: "how-to-turn-powerpoint-into-notes",
        pageId: "7c7f5553-e394-4bfe-9d94-2d4839203832",
      },
      {
        slug: "how-to-make-a-sign-up-sheet-on-google-forms",
        pageId: "4454c767-1643-4950-b9ce-939489e4e29c",
      },
      {
        slug: "download-google-slides-presentation",
        pageId: "232fee57-afc9-4de2-bc01-7ede244a212d",
      },
      {
        slug: "how-to-compress-photos-in-powerpoin",
        pageId: "be8ae224-55a5-4699-b529-c91b0cf7cab6",
      },
      {
        slug: "how-to-change-shape-of-image-in-google-slides",
        pageId: "4f11047d-778c-41b9-898f-bdf92d23025d",
      },
      {
        slug: "how-to-put-a-picture-in-a-shape-on-google-slides",
        pageId: "a987250d-2c9b-45c9-8c53-76a1ca2191ea",
      },
      {
        slug: "How-to-convert-Youtube-Video-to-PPT",
        pageId: "94d13298-5e42-4b25-bae4-087e97310c13",
      },
      {
        slug: "convert-canva-design-to-word-document-guide",
        pageId: "8d58ab52-3501-4b44-8f35-8196a63fdc4d",
      },
      {
        slug: "how-to-insert-pdf-into-google-slides",
        pageId: "5f9e4f3b-2e17-4e2c-9eab-350be082df6c",
      },
      {
        slug: "How-to-record-google-slides-with-voice",
        pageId: "1e07be7a-166b-4cff-a165-8e5bfe77d505",
      },
      {
        slug: "how-to-put-a-canva-presentation-in-google-slides",
        pageId: "8a879e8d-cc9b-42f4-b826-8c7779b40bfc",
      },
      {
        slug: "how-to-paste-on-google-docs-without-losing-formatting",
        pageId: "cdf66d90-e372-4889-a143-2792668ad334",
      },
      {
        slug: "how-to-strike-through-a-text-in-google-slides",
        pageId: "4cb8e977-e19e-467f-b746-3b39528d6bea",
      },
      {
        slug: "how-to-remove-footer-in-powerpoint",
        pageId: "6d293a91-b6ca-48ec-bd05-219a0eb391a6",
      },
      {
        slug: "how-to-remove-all-animations-from-powerpoint",
        pageId: "5f586c19-c194-4b67-a454-664bb22f4668",
      },
      {
        slug: "slack-remove-someone-from-direct-message",
        pageId: "ff2b79a6-392f-4da0-9ca6-5d53a6797b37",
      },
      {
        slug: "how-to-convert-canva-to-powerpoint",
        pageId: "3c39c468-fbe6-403c-b317-9547b59033c6",
      },
      {
        slug: "how-to-edit-responses-in-google-forms",
        pageId: "fd7b92f7-5d21-4d6b-8bc5-312fc3d3bd3f",
      },
      {
        slug: "how-to-change-bullet-color-in-powerpoint",
        pageId: "87229af5-60b0-4d0f-af50-0c20b7450676",
      },
      {
        slug: "How-to-convert-academic-research-papers-to-powerpoint-for-effective-presentation-delivery",
        pageId: "cf445f80-52b1-4bf8-9045-912cac0df856",
      },
      {
        slug: "how-to-wrap-text-around-images-in-google-slides",
        pageId: "157be5e8-01e2-4333-835e-765230de54c0",
      },
      {
        slug: "How-to-get-more-themes-for-google-slides",
        pageId: "c77104f3-0c3c-4c1e-895f-5dbeed168215",
      },
      {
        slug: "how-to-limit-the-number-of-responses-on-a-google-form",
        pageId: "888dfd22-ce4e-456c-b783-2bd60448f2ea",
      },
      {
        slug: "curve-text-in-google-slides",
        pageId: "c5c7b19d-c2a4-446b-9ced-fe743fae05ad",
      },
      {
        slug: "how-to-make-google-forms-public",
        pageId: "881c7391-ec2f-482f-b2e7-206361452fc1",
      },
      {
        slug: "how-to-unlock-powerpoint-from-editing",
        pageId: "c12d2ed7-8438-49ed-9612-0e885f9f0562",
      },
    ];

    let rows = allRows.filter((row) => {
      return blogs.some((blog) => blog.pageId === row.id);
    });

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

    const rows = notionResponse.results.filter(
      (row) => row.properties.Published?.checkbox === true
    );

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
