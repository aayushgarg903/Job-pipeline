# Employer survey (≤ 6 minutes), English and Marathi

> Paste-ready for Google Forms. It mirrors the in-app survey, so every answer loads straight into `survey_response` (see [Architecture.md §3](../Architecture.md) and `SurveyInput` in `packages/contracts/src/ports.ts`).
> Build **two forms** (English, Marathi) from the same question list, or one form with both languages in each question title as "English / मराठी". Two forms read better on a phone.
> Target: ≥ 25 responses by 18 Oct, ≥ 50 by early Nov (Plan.md §4). Owner: F (Domain / Pitch).

## Google Form settings

- Collect email addresses: **off** (we ask for contact separately, with consent).
- Limit to 1 response: **off** (many small employers don't have Google accounts). We dedupe on Udyam number + role.
- Show progress bar: **on**. One section per page.
- Q1 (consent) is required, and answering "No" jumps to "Submit form".
- Section 4 (skills) repeats. Google Forms can't loop, so we build 5 skill blocks, and after each block a question "Add another skill?" jumps to the next block or to Section 5.

## Field map (for the import script)

| Form question | `survey_response` / `SurveyInput` field | Stored as |
|---|---|---|
| Q3 Organisation name | `employerName` → `employer.name` | text |
| Q4 Udyam number | `employer.udyam_no` (links to `employer_id`, sets `verified`) | text, optional |
| Q5 District | `lgd_code` | LGD code from the 36-district lookup |
| Q6 Sector | `sector`, `employer.nic_code` | NIC-2008 division (2 digit); refined to NIC-5 from Udyam if Q4 given |
| Q7 Size | `employer.size_band` | micro / small / medium / large |
| Q8 Role | `nco_code` | NCO-2015 code from the role table below |
| Q9 Expected hires | `expected_hires_12m` | integer |
| Q10 Hires per posting | `posting_to_hire_ratio` | midpoint of the range (0, 0.5, 1, 2.5, 7, 12); "don't post online" → null |
| Q11 to Q13 (× up to 5) | `skill_id`, `importance`, `proficiency` | skill text → canonical skill via alias → trigram → vector match, low confidence → review queue; importance `mandatory` / `preferred` / `nice`; proficiency 1 to 4 |
| Q14 CSAT | `csat_recent_hires` | 1 to 5, "haven't hired" → null |
| Q15 Weeks to productivity | `weeks_to_productivity` | midpoint (0.5, 1.5, 3.5, 6.5, 10.5, 14); "haven't hired" → null |
| Q16 Comment | `comment` | text |
| Q17 PR review opt-in | routes Curriculum PRs to this employer | yes / no |
| Q18 Show name on endorsements | seal shows organisation name, or "a local employer" | yes / no |
| Timestamp | `collected_at` | form timestamp |

One form submission creates one `survey_response` row **per skill** (same employer, district, role, hires and ratings on each row), which matches the table's grain.

---

# ENGLISH VERSION

**Form title:** What skills do you need? A 5-minute survey for Maharashtra employers

**Form description:**
> We're a student team building Kaushal Setu for Smart India Hackathon 2026, on a problem set by the Govt. of Maharashtra (Dept. of Skills, Employment, Entrepreneurship and Innovation). We want ITI and skill-course training to match what employers in your district actually need.
> Your answers go into one thing: telling ITIs which skills to add, drop or strengthen, with your district's voice behind it. It takes about 5 minutes. Answer for **one role** you hire for. If you hire for several, you can fill the form again.

## Section 1. Consent

**Q1. Consent under the Digital Personal Data Protection Act, 2023** *(required, multiple choice)*

> **What we collect:** your organisation's name, district, sector and hiring needs; your name and phone or email only if you give them for follow-up.
> **Why:** to estimate skill demand by district and to suggest changes to skill-course curricula. Nothing else.
> **What we show:** only totals by district, sector and role. Your organisation's name is shown only if you say yes to Q18.
> **What we never do:** sell your data, share your contact details, or use them for marketing.
> **How long we keep it:** until the end of the hackathon evaluation, or longer only if the project is adopted by the Government of Maharashtra and you are informed.
> **Your rights:** you can ask to see, correct or delete your answers at any time by writing to [TEAM EMAIL] or [PHONE]. You can withdraw consent the same way, and we will delete your responses.
> **Data fiduciary for this survey:** Team [TEAM NAME], [College], [City]. Contact: [NAME], [TEAM EMAIL].

- Yes, I agree to share this information for the purpose above
- No, I don't agree *(→ submit form)*

## Section 2. About your organisation (1 minute)

**Q2. Your name and phone or email** *(optional, short answer)*
Helper text: Only if you're happy for us to call back with a question. Leave blank to stay anonymous.

**Q3. Organisation name** *(required, short answer)*

**Q4. Udyam registration number** *(optional, short answer)*
Helper text: Looks like UDYAM-MH-00-0000000. It helps us count one employer once. Leave blank if you don't have it handy.

**Q5. Which district is your workplace in?** *(required, dropdown)*
Ahilyanagar (Ahmednagar) · Akola · Amravati · Beed · Bhandara · Buldhana · Chandrapur · Chhatrapati Sambhajinagar (Aurangabad) · Dharashiv (Osmanabad) · Dhule · Gadchiroli · Gondia · Hingoli · Jalgaon · Jalna · Kolhapur · Latur · Mumbai City · Mumbai Suburban · Nagpur · Nanded · Nandurbar · Nashik · Palghar · Parbhani · Pune · Raigad · Ratnagiri · Sangli · Satara · Sindhudurg · Solapur · Thane · Wardha · Washim · Yavatmal

**Q6. What does your organisation mainly do?** *(required, multiple choice, with "Other")*
- Manufacturing: automobiles and auto parts (NIC 29)
- Manufacturing: machinery and equipment (NIC 28)
- Manufacturing: metal products, fabrication (NIC 25)
- Manufacturing: electrical equipment, including solar and EV (NIC 27)
- Manufacturing: electronics and computers (NIC 26)
- Food products and processing (NIC 10)
- Agriculture and allied (NIC 01)
- Electricity, solar installation and power (NIC 35)
- Warehousing, logistics and transport (NIC 49 to 53)
- IT, software and data services (NIC 62, 63)
- Healthcare: hospitals, clinics, labs (NIC 86)
- Other: ______

**Q7. How many people work at your organisation?** *(required, multiple choice)*
- 1 to 10
- 11 to 50
- 51 to 250
- More than 250

## Section 3. The role you're hiring for (1 minute)

**Q8. Which role are you answering about?** *(required, dropdown, with "Other")*
Helper text: Pick the closest one. If it's not here, choose Other and type it in your own words.
- Electrician (wiring, maintenance)
- Solar PV installer / technician
- EV technician / EV charging
- Electronics mechanic / repair
- Fitter
- CNC operator / programmer
- Machinist / turner
- Welder
- Motor vehicle mechanic
- Refrigeration and AC technician / cold-chain
- Food processing worker / machine operator
- Food safety supervisor / quality checker
- Warehouse associate / storekeeper
- Forklift operator
- Supply chain / logistics executive
- Data analyst
- Customer support executive
- General Duty Assistant (GDA) / patient care
- Lab technician
- Pharmacy assistant
- Other: ______

**Q9. How many people do you expect to hire for this role in the next 12 months?** *(required, short answer, number, validation: whole number 0 to 5000)*
Helper text: A rough number is fine. Count new hires only, not people already working.

**Q10. When you advertise this kind of role online, how many people do you finally hire per advertisement?** *(required, multiple choice)*
Helper text: Think about the last 12 months. This tells us how to read online job ads for your area.
- We posted, but hired nobody from it
- Less than 1 hire per ad (many ads, few hires)
- About 1 hire per ad
- 2 to 3 hires per ad
- 4 to 10 hires per ad
- More than 10 hires per ad
- We don't advertise this role online

## Section 4. The skills you need (2 minutes, repeat up to 5 times)

Section description: Tell us the skills that matter most for this role. Start with the most important. Use your own words, for example "Fanuc CNC controls", "solar panel wiring", "Tally", "forklift licence".

**Q11. Skill** *(required in block 1, optional in blocks 2 to 5, short answer)*

**Q12. How important is this skill when you hire?** *(required if Q11 answered, multiple choice)*
- Must-have: we won't hire without it
- Preferred: we hire faster if they have it
- Nice to have: we can teach it on the job

**Q13. What level do they need on day one?** *(required if Q11 answered, multiple choice)*
- 1. Basic: knows what it is, can do it with close supervision
- 2. Working: can do routine tasks alone
- 3. Advanced: handles problems and non-routine jobs alone
- 4. Expert: can set it up, fix anything, and train others

**Add another skill?** *(multiple choice, section jump)*
- Yes *(→ next skill block)*
- No, that's all *(→ Section 5)*

## Section 5. Your recent hires (1 minute)

**Q14. How satisfied are you with the people you hired from ITIs or PMKVY centres in the last 12 months?** *(required, linear scale 1 to 5, plus option)*
- 1 = Not at all ready for the job · 5 = Fully job-ready
- We haven't hired from an ITI or PMKVY centre in the last 12 months

**Q15. How long does a new ITI or PMKVY hire take to work at full speed?** *(required, multiple choice)*
- Less than 1 week
- 1 to 2 weeks
- 3 to 4 weeks
- 5 to 8 weeks
- 9 to 12 weeks
- More than 12 weeks
- We haven't hired from an ITI or PMKVY centre in the last 12 months

**Q16. Anything ITIs should teach, stop teaching, or teach differently?** *(optional, paragraph)*

## Section 6. Stay involved (30 seconds)

**Q17. When we suggest a change to a local course, can we send it to you to review?** *(required, multiple choice)*
Helper text: You'd get a short list of proposed changes and can say Endorse, Request change, or Not relevant. About 2 minutes, a few times a year.
- Yes, send me course changes to review (we'll use the contact from Q2)
- No, thanks

**Q18. If you endorse a course change, can we show your organisation's name on it?** *(required, multiple choice)*
- Yes, show our name
- No, show it as "a local employer"

**Confirmation message:**
> Thank you. Your answers will be counted in your district's skill demand within a week. If you said yes to reviewing course changes, the first one will come to you by WhatsApp or email. To see, correct or delete your answers, write to [TEAM EMAIL].

---

# मराठी आवृत्ती (MARATHI VERSION)

**फॉर्मचे शीर्षक:** तुम्हाला कोणती कौशल्ये हवी आहेत? महाराष्ट्रातील उद्योजकांसाठी ५ मिनिटांचे सर्वेक्षण

**फॉर्मचे वर्णन:**
> आम्ही विद्यार्थ्यांची एक टीम आहोत आणि स्मार्ट इंडिया हॅकेथॉन २०२६ साठी "कौशल सेतू" तयार करत आहोत. हा प्रश्न महाराष्ट्र शासनाच्या कौशल्य, रोजगार, उद्योजकता व नाविन्यता विभागाने दिला आहे. तुमच्या जिल्ह्यातील उद्योगांना प्रत्यक्षात जी कौशल्ये लागतात, तीच ITI आणि कौशल्य अभ्यासक्रमांत शिकवली जावीत, हा आमचा उद्देश आहे.
> तुमची उत्तरे एकाच कामासाठी वापरली जातील: ITI ला कोणती कौशल्ये जोडावीत, काढावीत किंवा मजबूत करावीत हे तुमच्या जिल्ह्याच्या आवाजासह सांगणे. सुमारे ५ मिनिटे लागतील. तुम्ही भरती करता अशा **एका पदासाठी** उत्तरे द्या. अनेक पदांसाठी भरती करत असल्यास फॉर्म पुन्हा भरू शकता.

## विभाग १. संमती

**प्र. १. डिजिटल वैयक्तिक डेटा संरक्षण अधिनियम, २०२३ अंतर्गत संमती** *(आवश्यक)*

> **आम्ही काय घेतो:** तुमच्या संस्थेचे नाव, जिल्हा, क्षेत्र आणि भरतीची गरज; तुम्ही पुढील संपर्कासाठी दिल्यासच तुमचे नाव आणि फोन किंवा ईमेल.
> **कशासाठी:** जिल्हानिहाय कौशल्यांची मागणी काढण्यासाठी आणि कौशल्य अभ्यासक्रमांत बदल सुचवण्यासाठी. इतर कशासाठीही नाही.
> **आम्ही काय दाखवतो:** फक्त जिल्हा, क्षेत्र आणि पदानुसार एकूण आकडे. प्र. १८ ला "हो" म्हटल्यासच तुमच्या संस्थेचे नाव दाखवले जाईल.
> **आम्ही काय कधीच करत नाही:** तुमचा डेटा विकत नाही, तुमचे संपर्क तपशील कोणाला देत नाही, जाहिरातीसाठी वापरत नाही.
> **किती काळ ठेवतो:** हॅकेथॉनचे मूल्यमापन संपेपर्यंत. महाराष्ट्र शासनाने प्रकल्प स्वीकारल्यास आणि तुम्हाला कळवल्यासच त्यापुढे.
> **तुमचे अधिकार:** तुमची उत्तरे पाहणे, दुरुस्त करणे किंवा हटवणे यासाठी कधीही [TEAM EMAIL] किंवा [PHONE] वर लिहा. त्याच प्रकारे संमती मागे घेता येईल आणि आम्ही तुमची उत्तरे हटवू.
> **या सर्वेक्षणाचे डेटा फिड्युशियरी:** टीम [TEAM NAME], [College], [City]. संपर्क: [NAME], [TEAM EMAIL].

- होय, वरील उद्देशासाठी ही माहिती देण्यास माझी संमती आहे
- नाही, माझी संमती नाही *(→ फॉर्म सबमिट)*

## विभाग २. तुमच्या संस्थेविषयी (१ मिनिट)

**प्र. २. तुमचे नाव आणि फोन किंवा ईमेल** *(ऐच्छिक)*
सूचना: आम्ही एखादा प्रश्न विचारण्यासाठी फोन केलेला चालणार असेल तरच भरा. नाव गुप्त ठेवायचे असल्यास रिकामे ठेवा.

**प्र. ३. संस्थेचे नाव** *(आवश्यक)*

**प्र. ४. उद्यम नोंदणी क्रमांक** *(ऐच्छिक)*
सूचना: UDYAM-MH-00-0000000 असा असतो. एका संस्थेला एकदाच मोजण्यासाठी उपयोगी. आत्ता हाताशी नसल्यास रिकामे ठेवा.

**प्र. ५. तुमचे कामाचे ठिकाण कोणत्या जिल्ह्यात आहे?** *(आवश्यक, ड्रॉपडाउन)*
अहिल्यानगर (अहमदनगर) · अकोला · अमरावती · बीड · भंडारा · बुलढाणा · चंद्रपूर · छत्रपती संभाजीनगर (औरंगाबाद) · धाराशिव (उस्मानाबाद) · धुळे · गडचिरोली · गोंदिया · हिंगोली · जळगाव · जालना · कोल्हापूर · लातूर · मुंबई शहर · मुंबई उपनगर · नागपूर · नांदेड · नंदुरबार · नाशिक · पालघर · परभणी · पुणे · रायगड · रत्नागिरी · सांगली · सातारा · सिंधुदुर्ग · सोलापूर · ठाणे · वर्धा · वाशिम · यवतमाळ

**प्र. ६. तुमची संस्था मुख्यतः काय करते?** *(आवश्यक, "इतर" पर्यायासह)*
- उत्पादन: वाहने व वाहनांचे सुटे भाग (NIC 29)
- उत्पादन: यंत्रसामग्री व उपकरणे (NIC 28)
- उत्पादन: धातू उत्पादने, फॅब्रिकेशन (NIC 25)
- उत्पादन: विद्युत उपकरणे, सोलर व EV सह (NIC 27)
- उत्पादन: इलेक्ट्रॉनिक्स व संगणक (NIC 26)
- अन्न उत्पादने व प्रक्रिया (NIC 10)
- शेती व संलग्न व्यवसाय (NIC 01)
- वीज, सोलर बसवणी व ऊर्जा (NIC 35)
- गोदाम, लॉजिस्टिक्स व वाहतूक (NIC 49 ते 53)
- IT, सॉफ्टवेअर व डेटा सेवा (NIC 62, 63)
- आरोग्य: रुग्णालये, दवाखाने, प्रयोगशाळा (NIC 86)
- इतर: ______

**प्र. ७. तुमच्या संस्थेत किती लोक काम करतात?** *(आवश्यक)*
- १ ते १०
- ११ ते ५०
- ५१ ते २५०
- २५० पेक्षा जास्त

## विभाग ३. तुम्ही भरती करत असलेले पद (१ मिनिट)

**प्र. ८. तुम्ही कोणत्या पदाबद्दल उत्तर देत आहात?** *(आवश्यक, ड्रॉपडाउन, "इतर" पर्यायासह)*
सूचना: सर्वात जवळचे पद निवडा. यादीत नसल्यास "इतर" निवडून तुमच्या शब्दांत लिहा.
- इलेक्ट्रिशियन (वायरिंग, देखभाल)
- सोलर PV बसवणारा / तंत्रज्ञ
- EV तंत्रज्ञ / EV चार्जिंग
- इलेक्ट्रॉनिक्स मेकॅनिक / दुरुस्ती
- फिटर
- CNC ऑपरेटर / प्रोग्रामर
- मशिनिस्ट / टर्नर
- वेल्डर
- मोटार वाहन मेकॅनिक
- रेफ्रिजरेशन व AC तंत्रज्ञ / कोल्ड-चेन
- अन्नप्रक्रिया कामगार / मशीन ऑपरेटर
- अन्न सुरक्षा पर्यवेक्षक / गुणवत्ता तपासणी
- गोदाम सहाय्यक / स्टोअरकीपर
- फोर्कलिफ्ट ऑपरेटर
- सप्लाय चेन / लॉजिस्टिक्स एक्झिक्युटिव्ह
- डेटा विश्लेषक (डेटा ॲनालिस्ट)
- ग्राहक सेवा एक्झिक्युटिव्ह
- जनरल ड्युटी असिस्टंट (GDA) / रुग्ण सेवा
- लॅब तंत्रज्ञ
- फार्मसी सहाय्यक
- इतर: ______

**प्र. ९. पुढील १२ महिन्यांत या पदासाठी किती लोकांची भरती करण्याची अपेक्षा आहे?** *(आवश्यक, संख्या, ० ते ५०००)*
सूचना: अंदाजे आकडा चालेल. फक्त नवीन भरती मोजा, आधीपासून काम करणारे नाहीत.

**प्र. १०. अशा पदाची ऑनलाइन जाहिरात दिल्यावर एका जाहिरातीतून प्रत्यक्षात किती लोकांची भरती होते?** *(आवश्यक)*
सूचना: गेल्या १२ महिन्यांचा विचार करा. यावरून तुमच्या भागातील ऑनलाइन जाहिराती कशा समजाव्यात हे आम्हाला कळते.
- जाहिरात दिली, पण त्यातून कोणीच भरती झाले नाही
- एका जाहिरातीमागे १ पेक्षा कमी (जाहिराती जास्त, भरती कमी)
- एका जाहिरातीमागे साधारण १
- एका जाहिरातीमागे २ ते ३
- एका जाहिरातीमागे ४ ते १०
- एका जाहिरातीमागे १० पेक्षा जास्त
- या पदाची आम्ही ऑनलाइन जाहिरात देत नाही

## विभाग ४. तुम्हाला लागणारी कौशल्ये (२ मिनिटे, ५ वेळा पर्यंत)

विभागाचे वर्णन: या पदासाठी सर्वात महत्त्वाची कौशल्ये सांगा. सर्वात महत्त्वाच्यापासून सुरुवात करा. तुमच्या शब्दांत लिहा, उदा. "Fanuc CNC कंट्रोल", "सोलर पॅनल वायरिंग", "Tally", "फोर्कलिफ्ट लायसन्स".

**प्र. ११. कौशल्य** *(पहिल्या भागात आवश्यक, पुढे ऐच्छिक)*

**प्र. १२. भरती करताना हे कौशल्य किती महत्त्वाचे आहे?** *(प्र. ११ भरल्यास आवश्यक)*
- अत्यावश्यक: याशिवाय आम्ही भरती करत नाही
- प्राधान्य: हे असल्यास लवकर भरती होते
- असल्यास चांगले: कामावर शिकवू शकतो

**प्र. १३. पहिल्या दिवशी कोणत्या पातळीचे कौशल्य हवे?** *(प्र. ११ भरल्यास आवश्यक)*
- १. प्राथमिक: माहिती आहे, जवळच्या देखरेखीखाली करू शकतो
- २. कामचलाऊ: रोजची कामे स्वतः करू शकतो
- ३. प्रगत: अडचणी आणि वेगळी कामे स्वतः हाताळतो
- ४. तज्ज्ञ: सेटअप करू शकतो, काहीही दुरुस्त करतो, इतरांना शिकवतो

**आणखी एक कौशल्य जोडायचे?**
- होय *(→ पुढील कौशल्य)*
- नाही, एवढेच *(→ विभाग ५)*

## विभाग ५. तुमची अलीकडची भरती (१ मिनिट)

**प्र. १४. गेल्या १२ महिन्यांत ITI किंवा PMKVY केंद्रातून भरती केलेल्या लोकांबद्दल तुम्ही किती समाधानी आहात?** *(आवश्यक, १ ते ५)*
- १ = कामासाठी अजिबात तयार नाहीत · ५ = कामासाठी पूर्ण तयार
- गेल्या १२ महिन्यांत ITI किंवा PMKVY केंद्रातून भरती केलेली नाही

**प्र. १५. ITI किंवा PMKVY मधून आलेल्या नवीन व्यक्तीला पूर्ण वेगाने काम करायला किती वेळ लागतो?** *(आवश्यक)*
- १ आठवड्यापेक्षा कमी
- १ ते २ आठवडे
- ३ ते ४ आठवडे
- ५ ते ८ आठवडे
- ९ ते १२ आठवडे
- १२ आठवड्यांपेक्षा जास्त
- गेल्या १२ महिन्यांत ITI किंवा PMKVY केंद्रातून भरती केलेली नाही

**प्र. १६. ITI ने काय शिकवावे, काय शिकवणे थांबवावे, किंवा वेगळ्या पद्धतीने शिकवावे?** *(ऐच्छिक)*

## विभाग ६. संपर्कात राहा (३० सेकंद)

**प्र. १७. स्थानिक अभ्यासक्रमात बदल सुचवल्यावर तो तुम्हाला तपासण्यासाठी पाठवू का?** *(आवश्यक)*
सूचना: सुचवलेल्या बदलांची छोटी यादी येईल. "समर्थन", "बदल सुचवा" किंवा "लागू नाही" असे उत्तर देता येईल. सुमारे २ मिनिटे, वर्षातून काही वेळा.
- होय, अभ्यासक्रमातील बदल तपासण्यासाठी पाठवा (प्र. २ मधील संपर्क वापरू)
- नको, धन्यवाद

**प्र. १८. तुम्ही एखाद्या बदलाला समर्थन दिल्यास त्यावर तुमच्या संस्थेचे नाव दाखवू का?** *(आवश्यक)*
- होय, आमचे नाव दाखवा
- नको, "एक स्थानिक उद्योजक" असे दाखवा

**पुष्टी संदेश:**
> धन्यवाद. तुमची उत्तरे आठवड्याभरात तुमच्या जिल्ह्याच्या कौशल्य मागणीत मोजली जातील. अभ्यासक्रमातील बदल तपासण्यास "होय" म्हटले असल्यास पहिला बदल WhatsApp किंवा ईमेलवर येईल. तुमची उत्तरे पाहणे, दुरुस्त करणे किंवा हटवण्यासाठी [TEAM EMAIL] वर लिहा.

---

## Role → NCO-2015 lookup (for the import script, not shown on the form)

NCO-2015 follows ISCO-08 at the 4-digit unit-group level. The codes below are the unit groups we expect. **AI / Data owner (C / B): confirm each against the NCO-2015 volume and pick the 8-digit occupation before import.**

| Form role | NCO-2015 unit group (verify) |
|---|---|
| Electrician (wiring, maintenance) | 7411 Building and related electricians |
| Solar PV installer / technician | 7411 (verify; may sit under 7412) |
| EV technician / EV charging | 7412 Electrical mechanics and fitters (verify) |
| Electronics mechanic / repair | 7421 Electronics mechanics and servicers |
| Fitter | 7233 Agricultural and industrial machinery mechanics (verify) |
| CNC operator / programmer | 7223 Metal working machine tool setters and operators |
| Machinist / turner | 7223 |
| Welder | 7212 Welders and flame cutters |
| Motor vehicle mechanic | 7231 Motor vehicle mechanics and repairers |
| Refrigeration and AC technician / cold-chain | 7127 Air conditioning and refrigeration mechanics |
| Food processing worker / machine operator | 8160 Food and related products machine operators |
| Food safety supervisor / quality checker | verify (3257 or 7515) |
| Warehouse associate / storekeeper | 4321 Stock clerks |
| Forklift operator | 8344 Lifting truck operators |
| Supply chain / logistics executive | 4323 Transport clerks (verify) |
| Data analyst | verify (2511 or 2120) |
| Customer support executive | 4222 Contact centre information clerks |
| General Duty Assistant / patient care | 5321 Health care assistants |
| Lab technician | 3212 Medical and pathology laboratory technicians |
| Pharmacy assistant | 3213 Pharmaceutical technicians and assistants |
| Other (free text) | → review queue, mapped by title → NCO matcher |

---

## Outreach messages (WhatsApp)

Send from a personal number that belongs to a named team member, not a bulk sender. Replace the brackets. Keep the link on its own line so WhatsApp previews it.

### To MCCIA (Pune) or NIMA (Nashik) office-bearers

**English**
> Namaskar [Name] ji. I'm [Your name] from [College], Pune. Our team is building Kaushal Setu for Smart India Hackathon 2026, on a problem set by the Govt. of Maharashtra's Skills department: making ITI courses match what local industry needs.
>
> Could you share this 5-minute survey with your member companies? It asks one employer about one role: how many people they'll hire, which skills are must-haves, and how ready recent ITI hires were.
>
> [FORM LINK]
>
> Only district totals are shown. No company name appears without permission. In return, we'll share the [Pune / Nashik] results with [MCCIA / NIMA] before anyone else. Happy to come and explain in 10 minutes. Thank you.

**मराठी**
> नमस्कार [Name] जी. मी [Your name], [College], पुणे येथून. आमची टीम स्मार्ट इंडिया हॅकेथॉन २०२६ साठी "कौशल सेतू" तयार करत आहे. हा प्रश्न महाराष्ट्र शासनाच्या कौशल्य विभागाने दिला आहे: ITI अभ्यासक्रम स्थानिक उद्योगांच्या गरजेनुसार व्हावेत.
>
> हे ५ मिनिटांचे सर्वेक्षण तुमच्या सदस्य कंपन्यांना पाठवू शकाल का? एका उद्योजकाला एका पदाबद्दल विचारले जाते: किती भरती होईल, कोणती कौशल्ये अत्यावश्यक आहेत, आणि अलीकडे भरती केलेले ITI उमेदवार किती तयार होते.
>
> [FORM LINK]
>
> फक्त जिल्ह्याचे एकूण आकडे दाखवले जातात. परवानगीशिवाय कोणत्याही कंपनीचे नाव दिसणार नाही. त्याबदल्यात [पुणे / नाशिक] चे निकाल आम्ही सर्वात आधी [MCCIA / NIMA] ला देऊ. १० मिनिटांत प्रत्यक्ष येऊन समजावून सांगायला आनंद होईल. धन्यवाद.

### To ITI placement officers

**English**
> Namaskar Sir / Madam. I'm [Your name] from [College]. We're building Kaushal Setu for Smart India Hackathon 2026, for the Govt. of Maharashtra's Skills department. It tells an ITI which skills local employers want added to a trade, with the employers' own words as evidence.
>
> Could you forward this 5-minute survey to the companies that recruit from your ITI?
>
> [FORM LINK]
>
> We'll send you a one-page summary for your ITI: which skills your recruiters marked must-have, and how satisfied they were with recent batches. Nothing identifies a company without its permission. Thank you.

**मराठी**
> नमस्कार सर / मॅडम. मी [Your name], [College] येथून. आम्ही महाराष्ट्र शासनाच्या कौशल्य विभागासाठी स्मार्ट इंडिया हॅकेथॉन २०२६ मध्ये "कौशल सेतू" तयार करत आहोत. स्थानिक उद्योजकांना एखाद्या ट्रेडमध्ये कोणती कौशल्ये हवी आहेत, हे त्यांच्याच शब्दांच्या पुराव्यासह ITI ला सांगणारी ही प्रणाली आहे.
>
> तुमच्या ITI मधून भरती करणाऱ्या कंपन्यांना हे ५ मिनिटांचे सर्वेक्षण पुढे पाठवू शकाल का?
>
> [FORM LINK]
>
> त्याबदल्यात तुमच्या ITI साठी एक पानाचा सारांश पाठवू: तुमच्या भरती करणाऱ्या कंपन्यांनी कोणती कौशल्ये अत्यावश्यक मानली, आणि अलीकडच्या बॅचबद्दल ते किती समाधानी होते. परवानगीशिवाय कोणत्याही कंपनीची ओळख उघड होणार नाही. धन्यवाद.

### Follow-up (send once, 4 days later, only if there's no reply)

**English**
> Namaskar [Name] ji, a gentle reminder about the 5-minute employer survey for Kaushal Setu. [N] employers in [district] have answered so far. Even 3 more would make [district]'s numbers much more reliable. [FORM LINK]. Thank you.

**मराठी**
> नमस्कार [Name] जी, कौशल सेतूच्या ५ मिनिटांच्या सर्वेक्षणाची एक आठवण. आतापर्यंत [district] मधील [N] उद्योजकांनी उत्तरे दिली आहेत. आणखी फक्त ३ उत्तरे आली तरी [district] चे आकडे खूप जास्त विश्वासार्ह होतील. [FORM LINK]. धन्यवाद.
