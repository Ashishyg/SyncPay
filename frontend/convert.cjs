const fs = require('fs');

const html = fs.readFileSync('.stitch/designs/Home.html', 'utf8');

// Extract Sidebar
const sidebarMatch = html.match(/<aside[\s\S]*?<\/aside>/);
let sidebarHtml = sidebarMatch ? sidebarMatch[0] : '';

// Extract Main
const mainMatch = html.match(/<main[\s\S]*?<\/main>/);
let mainHtml = mainMatch ? mainMatch[0] : '';

function convertToJsx(htmlStr) {
    let jsx = htmlStr;
    // class -> className
    jsx = jsx.replace(/class="/g, 'className="');
    // Self-closing tags
    jsx = jsx.replace(/<img([^>]*[^\/])>/g, '<img$1 />');
    jsx = jsx.replace(/<input([^>]*[^\/])>/g, '<input$1 />');
    jsx = jsx.replace(/<br([^>]*[^\/])>/g, '<br$1 />');
    jsx = jsx.replace(/<hr([^>]*[^\/])>/g, '<hr$1 />');
    // Style attributes (simple conversion for the specific ones used)
    jsx = jsx.replace(/style="font-variation-settings: 'FILL' 1;"/g, "style={{fontVariationSettings: \"'FILL' 1\"}}");
    return jsx;
}

fs.writeFileSync('sidebar.jsx.txt', convertToJsx(sidebarHtml));
fs.writeFileSync('main.jsx.txt', convertToJsx(mainHtml));
console.log('Done converting.');
