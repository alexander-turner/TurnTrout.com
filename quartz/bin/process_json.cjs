const turnDown = require("turndown")
var turnDownPluginGfm = require("turndown-plugin-gfm")
var gfm = turnDownPluginGfm.gfm

var turndownService = new turnDown({ headingStyle: "atx", emDelimiter: "_" })
turndownService.use([gfm])
turndownService.addRule("subscript", {
  filter: ["sub"],
  replacement: function (content) {
    return "<sub>" + content + "</sub>"
  },
})
turndownService.addRule("emphasis", {
  filter: ["em"],
  replacement: function (content) {
    return "" + content + "</sub>"
  },
})

const fs = require("fs")

const filePath = "/tmp/response (1).json"

fs.readFile(filePath, "utf-8", (err, data) => {
  if (err) {
    console.error("Error reading file:", err)
    return
  }

  let jsonData
  try {
    jsonData = JSON.parse(data)
    let dataObj = jsonData.data.posts.results
    for (let dataIndex in dataObj) {
      datum = dataObj[dataIndex]
      if (datum.contents?.html) {
        datum.contents.markdown = turndownService.turndown(datum.contents.html)
      }
    }
  } catch (parseErr) {
    console.error("Error parsing JSON:", parseErr)
    return
  }

  fs.writeFile("all_posts_md.json", JSON.stringify(jsonData, null, 2), (err) => {
    if (err) {
      console.error("Error writing file:", err)
    } else {
      console.log("JSON file updated successfully!")
    }
  })
})