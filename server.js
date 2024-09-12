require("dotenv").config();
const express = require("express");
const { Client } = require("@notionhq/client");
const { translate } = require("free-translate");
const supabase = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

const app = express();
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const supabaseClient = supabase.createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const downloadImage = async (url, outputPath) => {
  console.log(`Downloading image from URL: ${url}`);
  const localImagePath = path.resolve(outputPath);

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
};

app.get("/translate-and-duplicate-page", async function (req, res) {
  const sourcePageId = "5b4452291b6947a4be62d664c674118b";
  const destinationPageId = "ba747699f09a4ac5bf33fcabdc6721a6";

  try {
    console.log("Fetching source page properties...");
    const sourcePageProperties = await notion.pages.retrieve({
      page_id: sourcePageId,
    });
    console.log("Source page properties retrieved.");

    const {
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
    } = sourcePageProperties.properties;

    const AuthorSlug = sourcePageProperties.properties["Author Slug"];

    console.log("Updating destination page properties...");
    await notion.pages.update({
      page_id: destinationPageId,
      properties: {
        Name: {
          title: [
            {
              text: {
                content: Name?.title?.[0]?.text?.content || "Untitled",
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
                content: Desc?.rich_text?.[0]?.text?.content || "",
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
    console.log("Destination page updated successfully.");

    console.log("Fetching child blocks from source page...");
    const blocks = await notion.blocks.children.list({
      block_id: sourcePageId,
    });
    console.log("Source page child blocks retrieved.");

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

    const translateText = async (text) => {
      if (!text) return "";
      console.log(`Translating text: ${text}`);
      return await translate(text, { from: "en", to: "fr" });
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

    // Collect data to append in one request
    let childrenToAppend = [];

    for (const block of blocks.results) {
      const blockType = block.type;

      if (blockType === "image") {
        const imageDetails = formatBlock(block);
        console.log(`Processing image block: ${imageDetails.url}`);

        // Store the image locally and upload to Supabase
        const randomInteger = Math.floor(Math.random() * 1000);
        const localImagePath = path.join(__dirname, "download-img.jpg");
        await downloadImage(imageDetails.url, localImagePath);
        const supabaseUrl = await uploadToSupabase(
          localImagePath,
          `image${randomInteger}.jpg`
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

      if (translatedText) {
        console.log(`Collected translated block: ${translatedText}`);
        // Collect text block to append later
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

    // Append all children at once
    if (childrenToAppend.length > 0) {
      console.log("Appending all collected blocks to destination page...");
      await notion.blocks.children.append({
        block_id: destinationPageId,
        children: childrenToAppend,
      });
      console.log("All blocks appended successfully.");
    }

    res.json({
      message: "success",
      content:
        "Page content and properties translated and added to the new page successfully.",
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "error", error: error.message });
  }
});

app.get("/get-block-children", async function (req, res) {
  const blockId = "0bffa2aa66f541ca9794d323c0a47d59"; // Block ID for which you want to retrieve children

  try {
    console.log("Fetching child blocks for block ID:", blockId);
    const blockChildren = await notion.blocks.children.list({
      block_id: blockId,
    });

    console.log("Child blocks retrieved successfully.");
    res.json({
      message: "success",
      children: blockChildren,
    });
  } catch (error) {
    console.error("Error fetching block children:", error);
    res.status(500).json({
      message: "error",
      error: error.message,
    });
  }
});

const listener = app.listen(1000, function () {
  console.log("Your app is listening on port " + listener.address().port);
});
