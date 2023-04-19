import react, { useEffect, useState } from 'react';

import { parse, HTMLElement } from 'node-html-parser';

const axios = require('axios').default;
const deferred = require('deferred');

const medicaidTableURL = 'https://www.medicaid.gov/medicaid/national-medicaid-chip-program-information/medicaid-childrens-health-insurance-program-basic-health-program-eligibility-levels/index.html';

type TableHTML = {
  parsedString: string;
  footnoteID: string | null;
}

type TableCellHTML = TableHTML & {
  parsedPercent: number | null;
}

const parseTableHTML = function(str: string): TableHTML {
  let parsedString = str;
  try {
    const innerTagIndex = str.indexOf("<");
    if (innerTagIndex >= 0) {
      parsedString = str.substring(0, innerTagIndex);
    }
  }
  catch (err) { console.log(err) }
    
  let footnoteID = null;
  try {
    const footnoteStartIndex = str.search(/>[0-9]+</);
    if (footnoteStartIndex >= 0) {
      const footnoteEndIndex = str.indexOf("<", footnoteStartIndex);
      footnoteID = str.substring(footnoteStartIndex + 1, footnoteEndIndex);
    }
  }
  catch (err) { console.log(err) }

  return {
    parsedString,
    footnoteID
  }
}
const parseTableCellHTML = function(str: string): TableCellHTML {
  let parsedPercent = null;
  try {
    const percentIndex = str.indexOf("%");
    if (percentIndex >= 0) {
      parsedPercent = parseFloat(str.substring(0, percentIndex)) / 100.;
    }
  }
  catch (err) { console.log(err) }

  const parsedHTML = parseTableHTML(str);
  return {
    parsedPercent,
    ...parsedHTML
  }
}

const parseMedicaidTableToJson = function(medicaidTable: HTMLElement) {
  let columns: TableHTML[] | null = null;
  try {
    const headerRow = medicaidTable.childNodes[0];
    columns = headerRow.childNodes.filter((headerEle) => headerEle.nodeType === 1).map((headerEle: any) => parseTableHTML(headerEle.innerHTML));
  }
  catch (err) { console.log(err); }

  let data: TableCellHTML[][] = [];
  try {
    const [, ...dataRows] = medicaidTable.childNodes;

    for (let dataRow of dataRows) {
      data.push(dataRow.childNodes.filter((headerEle) => headerEle.nodeType === 1).map((headerEle: any) => parseTableCellHTML(headerEle.innerHTML)));
    }
  }
  catch (err) { console.log(err); }

  return {
    columns,
    data
  };
}

//TODO needs to be updated for latest page layout
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
    let table = {};

    const medicaidTableBody = medicaidTable?.querySelector("tbody");
    if (medicaidTableBody) {
      table = parseMedicaidTableToJson(medicaidTableBody);
    }

    let footnotes = [];
    const footnotesHTML = medicaidTable?.nextElementSibling;
    if (footnotesHTML) {
      footnotes = parseFootnoteListToJson(footnotesHTML);
    }

    medicaidTableRequest.resolve({
      table,
      footnotes,
      scrapedOn: new Date()
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
