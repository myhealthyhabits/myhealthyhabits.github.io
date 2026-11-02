const fs=require('fs');const L=fs.readFileSync('/workspace/calorie-tracker/app.js','utf8').split('\n');
const code=L.slice(55,112).join('\n');module.exports=new Function(code+';return {cleanName,cnBrand,cnBrandOf}')();
