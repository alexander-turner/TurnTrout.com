const turnDown = require("turndown")
var gfm = turndownPluginGfm.gfm
var tables = turndownPluginGfm.tables
var strikethrough = turndownPluginGfm.strikethrough
turndownService.use([tables, strikethrough, gfm])

var turndownService = new turnDown({ headingStyle: "atx" })
const fs = require("fs")

const filePath = "/tmp/all_posts.json"

fs.readFile(filePath, "utf-8", (err, data) => {
  if (err) {
    console.error("Error reading file:", err)
    return
  }

  let jsonData
  try {
    jsonData = JSON.parse(data)
    // const initialData = jsonData.copy();
    for (let datum in jsonData) {
      datum.contents.markdown = turndownService.turndown(datum.contents.html)
    }
  } catch (parseErr) {
    console.error("Error parsing JSON:", parseErr)
    return
  }

  fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), (err) => {
    if (err) {
      console.error("Error writing file:", err)
    } else {
      console.log("JSON file updated successfully!")
    }
  })
})
