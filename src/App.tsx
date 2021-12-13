import react, { useEffect, useState } from 'react';

import { parse, HTMLElement } from 'node-html-parser';

const axios = require('axios').default;
const deferred = require('deferred');

const medicaidTableURL = 'https://www.medicaid.gov/medicaid/national-medicaid-chip-program-information/medicaid-childrens-health-insurance-program-basic-health-program-eligibility-levels/index.html';

const parseTableHTML = function(str: string) {
  let parsedString = str;
  try {
    const innerTagIndex = str.indexOf("<");
    if (innerTagIndex >= 0) {
      parsedString = str.substring(0, innerTagIndex);
    }
  }
  catch (err) { console.log(err) }
  
  let parsedPercent = null;
  try {
    const percentIndex = str.indexOf("%");
    if (percentIndex >= 0) {
      parsedPercent = parseFloat(str.substring(0, percentIndex)) / 100.;
    }
  }
  catch (err) { console.log(err) }
  
  let superScript = null;
  try {
    const superScriptStartIndex = str.search(/>[0-9]+</);
    if (superScriptStartIndex >= 0) {
      const superScriptEndIndex = str.indexOf("<", superScriptStartIndex);
      superScript = str.substring(superScriptStartIndex + 1, superScriptEndIndex);
    }
  }
  catch (err) { console.log(err) }

  return {
    parsedString,
    parsedPercent,
    superScript
  }
}
const parseMedicaidTableToJson = function(medicaidTable: HTMLElement) {
  let columnNames = null;
  try {
    const headerRow = medicaidTable.childNodes[0];
    columnNames = headerRow.childNodes.filter((headerEle) => headerEle.nodeType === 1).map((headerEle: any) => parseTableHTML(headerEle.innerHTML));
  }
  catch (err) { console.log(err); }

  let data = [];
  try {
    const [, ...dataRows] = medicaidTable.childNodes;

    for (let dataRow of dataRows) {
      data.push(dataRow.childNodes.filter((headerEle) => headerEle.nodeType === 1).map((headerEle: any) => parseTableHTML(headerEle.innerHTML)));
    }
  }
  catch (err) { console.log(err); }

  return {
    columnNames,
    data
  };
}

const parseFootnoteListToJson = function(footnoteList: HTMLElement) {
  let footnotes: any[] = [];

  footnoteList.childNodes.filter((childNode) => childNode.nodeType === 1).forEach((footnoteObject: any) => {
    footnotes.push(footnoteObject.innerText.trim());
  });

  return footnotes;
}

const medicaidTableRequest = deferred();
axios.get(medicaidTableURL)
  .then((response: any) => {
    const root = parse(response.data);

    const medicaidTable = root.querySelector("#block-medicaid-content")?.querySelector("table");
    let medicaidTableJson = {};

    const medicaidTableBody = medicaidTable?.querySelector("tbody");
    if (medicaidTableBody) {
      medicaidTableJson = parseMedicaidTableToJson(medicaidTableBody);
    }

    let footnotesJson = [];
    const footnotes = medicaidTable?.nextElementSibling;
    if (footnotes) {
      footnotesJson = parseFootnoteListToJson(footnotes);
    }

    medicaidTableRequest.resolve({
      medicaidTableJson,
      footnotesJson
    })
  })
  .catch((error: any) => {
    console.log(error);

    medicaidTableRequest.reject();
  });

export function App() {
  const [medicaidJson, setMedicaidJson] = useState<any>(null);
  
  useEffect(() => {
    medicaidTableRequest.promise.then((medicaidTableResult: any) => {
      setMedicaidJson(medicaidTableResult);
    });
  }, []);

  return <div>{JSON.stringify(medicaidJson, undefined, 2)}</div>;
}
