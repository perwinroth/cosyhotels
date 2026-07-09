// Larger set of world cities; extend freely. Used by cron sweeps.
export const citiesLarge: string[] = [
  // Additional Americas
  "Philadelphia","Phoenix","San Diego","Dallas","Houston","San Antonio","Charlotte","Orlando","Tampa","Nashville",
  "Atlanta","New Orleans","Minneapolis","Detroit","Cleveland","Columbus","Indianapolis","Kansas City","St. Louis","Portland",
  "Ottawa","Quebec City","Calgary","Edmonton","Winnipeg","Halifax","Tijuana","Puebla","Cancun","Tulum",
  "Cartagena","Barranquilla","Cali","Cusco","Arequipa","Valparaiso","Vina del Mar","Montevideo","Punta del Este",
  // Additional Europe
  "Nice","Cannes","Lyon","Marseille","Bordeaux","Toulouse","Nantes","Lille","Strasbourg","Reims",
  "Granada","Cordoba","Zaragoza","Alicante","Malaga","Pamplona","Santiago de Compostela","Oviedo","A Coruña","Vigo",
  "Bari","Verona","Pisa","Lucca","Siena","Parma","Ravenna","Rimini","Perugia","Trieste",
  "Dresden","Leipzig","Cologne","Düsseldorf","Stuttgart","Nuremberg","Freiburg","Heidelberg","Bremen","Hanover",
  "Ghent","Bruges","Liege","Utrecht","Eindhoven","Maastricht","Groningen","Haarlem",
  "Innsbruck","Graz","Linz","Lucerne","Lugano","Lausanne","Interlaken","Zermatt","St. Moritz",
  "Reykjavik","Bucharest","Cluj-Napoca","Sibiu","Brasov","Timisoara","Varna","Sofia","Skopje","Tirana",
  // Additional MEA
  "Essaouira","Chefchaouen","Ouarzazate","Aswan","Luxor","Sharm El-Sheikh","Hurghada","Muscat","Salalah",
  "Kigali","Arusha","Zanzibar City","Maputo","Windhoek","Gaborone","Dakar","Marrere",
  // Additional Asia
  "Kobe","Yokohama","Kamakura","Nikko","Takayama","Matsumoto","Kawaguchiko","Sasebo",
  "Jeju","Gyeongju","Daejeon","Daegu","Taichung","Tainan","Hualien",
  "Suzhou","Guilin","Zhangjiajie","Lijiang","Harbin","Urumqi",
  "Pattaya","Krabi","Ayutthaya","Nakhon Ratchasima",
  "Hue","Nha Trang","Phu Quoc",
  "Malacca","Ipoh","Johor Bahru","Kota Kinabalu",
  "Surabaya","Bandung","Medan","Makassar","Lombok","Gili Trawangan",
  "Boracay","Tagaytay","Davao","Bohol",
  "Pune","Ahmedabad","Varanasi","Rishikesh","Amritsar","Shimla","Leh","Goa","Pondicherry","Mysuru",
  "Male","Thimphu",
  // Additional Oceania
  "Byron Bay","Gold Coast","Canberra","Hobart","Darwin","Rotorua","Taupo","Dunedin",
  // Cities with live, indexable collection pages that were sitemap-orphans because they were
  // missing here (2026-07-09 audit; each verified single-location + non-control in the DB).
  // Deliberately NOT added: Lexington, Woodstock, Keswick (each merges two same-named towns
  // in the DB today — a page would assert false inventory) and Savannah (control market).
  "Asheville","Banff","Stowe","Sedona","Skaneateles","Bath","Tofino","Sausalito","Middleburg",
  // Rustic-collection cities (enabled 2026-07-09) missing from the known list; each verified
  // single-location + non-control via DB lat/lng. Siena/Perugia were already listed above.
  "San Gimignano","Como","Montepulciano","Ronda","Füssen"
];

