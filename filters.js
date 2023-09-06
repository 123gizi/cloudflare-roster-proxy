var filters = [
    { 
      parameter: "summary",
      type: "exclude", //include/exclude
      comparison: "equals", // equals, begins with, contains, regex
      criterias: ["RDO", "STANDBY", "CAO", "ADM - Administration", "LDO", "ALV", "CARERS LEAVE", "SICK"]
    },
    { 
      parameter: "summary",
      type: "exclude", //include/exclude
      comparison: "contains", // equals, begins with, contains, regex
      criterias: ["SAPL", "STBY"]
    }
  ];
