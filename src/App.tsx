import react, { useEffect, useState } from 'react';

import { parse, HTMLElement } from 'node-html-parser';

const axios = require('axios').default;
const deferred = require('deferred');

const medicaidTableURL = 'https://www.medicaid.gov/medicaid/national-medicaid-chip-program-information/medicaid-childrens-health-insurance-program-basic-health-program-eligibility-levels/index.html';

type TableHTML = {
  parsedString: string;
  parsedPercent: number | null;
  footnoteID: string | null;
}

type TableHeaderHTML = TableHTML & {
  ageLowerBound: number;
  ageUpperBound: number | null;
  appliesToIndividuals: boolean;
  appliesWhenPregnant: boolean;
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
  
  let parsedPercent = null;
  try {
    const percentIndex = str.indexOf("%");
    if (percentIndex >= 0) {
      parsedPercent = parseFloat(str.substring(0, percentIndex)) / 100.;
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
    parsedPercent,
    footnoteID
  }
}
const parseTableHeaderHTML = function(str: string): TableHeaderHTML {
  const parsedHTML = parseTableHTML(str) as TableHeaderHTML;

  let parsedAgeLowerBound: number = 19;
  let parsedAgeUpperBound: number | null = null;
  try {
    if (str.indexOf("Children") >= 0) {
      const ageHypenIndex = str.indexOf("-", str.indexOf("Ages"));
      
      if (ageHypenIndex >= 0) {
        let ageLowerBoundIndex = ageHypenIndex - 1;
        while (str.charAt(ageLowerBoundIndex) != " ") {
          ageLowerBoundIndex--;
        }
        parsedAgeLowerBound = parseInt(str.substring(ageLowerBoundIndex, ageHypenIndex));

        let ageUpperBoundIndex = ageHypenIndex + 1;
        while (str.charAt(ageUpperBoundIndex) != "<") {
          ageUpperBoundIndex++;
        }
        parsedAgeUpperBound = parseInt(str.substring(ageHypenIndex + 1, ageUpperBoundIndex));
      }
      else if (str.indexOf("CHIP") >= 0) {
        parsedAgeLowerBound = 0;
        parsedAgeUpperBound = 19;
      }
    }
  }
  catch (err) { console.log(err) }

  parsedHTML.ageLowerBound = parsedAgeLowerBound;
  parsedHTML.ageUpperBound = parsedAgeUpperBound;

  let parsedAppliesToIndividuals: boolean = true;
  let parsedAppliesWhenPregnant: boolean = false;
  try {
    if (str.indexOf("Parent") >= 0 || str.indexOf("Caretaker") >= 0) {
      parsedAppliesToIndividuals = false;
      parsedAppliesWhenPregnant = true;
    }
    else if (str.indexOf("Pregnant") >= 0) {
      parsedAppliesWhenPregnant = true;
    }
  }
  catch (err) { console.log(err) }

  parsedHTML.appliesToIndividuals = parsedAppliesToIndividuals;
  parsedHTML.appliesWhenPregnant = parsedAppliesWhenPregnant;

  return parsedHTML;
}

const parseMedicaidTableToJson = function(medicaidTable: HTMLElement) {
  let columns: TableHeaderHTML[] | null = null;
  try {
    const headerRow = medicaidTable.childNodes[0];
    columns = headerRow.childNodes.filter((headerEle) => headerEle.nodeType === 1).map((headerEle: any) => parseTableHeaderHTML(headerEle.innerHTML));
  }
  catch (err) { console.log(err); }

  let data: TableHTML[][] = [];
  try {
    const [, ...dataRows] = medicaidTable.childNodes;

    for (let dataRow of dataRows) {
      data.push(dataRow.childNodes.filter((headerEle) => headerEle.nodeType === 1).map((headerEle: any) => parseTableHTML(headerEle.innerHTML)));
    }
  }
  catch (err) { console.log(err); }

  return {
    columns,
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
