export default async function handler(req, res) {

if(req.method !== "POST"){
return res.status(405).json({error:"Method not allowed"});
}

const data = req.body;

/* create slug */

const slug = data.name
.toLowerCase()
.replace(/[^a-z0-9]+/g,"-")
.replace(/(^-|-$)/g,"");

/* build JSON */

const campData = {

name:data.name,
location:data.location,
established:data.established,
hero:data.hero,
members:data.members,
traditions:data.traditions

};

/* GitHub API info */

const repo = "eisimmerman/deercamp";
const path = `camps/${slug}.json`;
const token = process.env.GITHUB_TOKEN;

/* write file to repo */

await fetch(`https://api.github.com/repos/${repo}/contents/${path}`,{

method:"PUT",

headers:{
Authorization:`token ${token}`,
"Content-Type":"application/json"
},

body:JSON.stringify({

message:`Create camp ${slug}`,
content:Buffer.from(JSON.stringify(campData,null,2)).toString("base64")

})

});

res.status(200).json({slug});

}
