import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  // CORS configuration for Vercel Serverless production deployment
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const { message, context } = body;
  const isGuest = !context || !context.user || context.user.role === "Guest";
  const userName = context?.user?.name || context?.user?.fullName || "Customer";
  const cleanMessage = (message || "").toLowerCase().trim();
  const contextLang = (context?.language || "").toLowerCase();
  const isHindiRequest = /[\u0900-\u097F]/.test(message || "") || contextLang.includes("hindi") || contextLang.includes("hi");

  if (!message || !message.trim()) {
    return res.status(400).json({
      serviceType: "Unknown",
      issueDetails: "Missing message",
      confidence: 0,
      nextQuestion: "Please provide a valid message.",
      isReadyToBook: false
    });
  }

  const txt = cleanMessage;

  // 1. Corporate Security Interceptor
  const isSensitiveQuery = 
    txt.includes("business model") || 
    txt.includes("revenue") || 
    txt.includes("income") || 
    txt.includes("accounting") ||
    txt.includes("profit") ||
    txt.includes("expense") || 
    txt.includes("operational cost") ||
    txt.includes("how much do you earn") ||
    txt.includes("code") || 
    txt.includes("architecture") || 
    txt.includes("proprietary") || 
    txt.includes("backend") || 
    txt.includes("database") || 
    txt.includes("technology") || 
    txt.includes("developer") || 
    txt.includes("identity") || 
    txt.includes("who built you") ||
    txt.includes("who programmed you") ||
    txt.includes("source code") ||
    txt.includes("platform cost") ||
    txt.includes("server cost") ||
    txt.includes("operational expense") ||
    txt.includes("company income");

  if (isSensitiveQuery) {
    return res.status(200).json({
      serviceType: "Unknown",
      issueDetails: "Sensitive corporate query intercepted",
      confidence: 100,
      nextQuestion: "क्षमा करें, मैं केवल Zomindia की घरेलू सेवाओं, बुकिंग और ऑफर्स से जुड़ी सहायता के लिए उपलब्ध हूँ। आंतरिक कंपनी नीतियों या डेटा की जानकारी साझा करने की अनुमति मुझे नहीं है।",
      isReadyToBook: false
    });
  }

  // 2. Out-of-Scope Interceptor
  const isUnrelatedQuery = 
    txt.includes("politics") ||
    txt.includes("food") ||
    txt.includes("laptop") ||
    txt.includes("tourism") ||
    txt.includes("poha") ||
    txt.includes("jalebi") ||
    txt.includes("bjp") ||
    txt.includes("congress") ||
    txt.includes("modi") ||
    txt.includes("election") ||
    txt.includes("restaurant") ||
    txt.includes("recipe") ||
    txt.includes("weather") ||
    txt.includes("news") ||
    txt.includes("hotel") ||
    txt.includes("travel") ||
    txt.includes("movie") ||
    txt.includes("sport") ||
    txt.includes("cricket");

  if (isUnrelatedQuery) {
    return res.status(200).json({
      serviceType: "Unknown",
      issueDetails: "Unrelated out-of-scope query intercepted",
      confidence: 100,
      nextQuestion: "Bhaiya, Indore ke poha-jalebi toh laajawab hain hi! Lekin main aapke ghar ke AC, electrical ya plumbing ki dikkat dur karne mein zyada mahir hoon. Bataiye aaj ghar mein kya fix karna hai?",
      isReadyToBook: false
    });
  }

  // 3. Unlisted Home Services Interceptor
  const isUnlistedService = 
    txt.includes("car wash") || txt.includes("car washing") || txt.includes("bike wash") || txt.includes("vehicle detailing") || txt.includes("car cleaning") ||
    txt.includes("beauty") || txt.includes("salon") || txt.includes("parlor") || txt.includes("parlour") || txt.includes("haircut") || txt.includes("makeup") || txt.includes("spa") || txt.includes("massage") ||
    txt.includes("painting") || txt.includes("painter") || txt.includes("wall paint") || txt.includes("house paint") || txt.includes("house painting") ||
    txt.includes("construction") || txt.includes("civil work") || txt.includes("renovation") || txt.includes("interior design") ||
    txt.includes("pest control") || txt.includes("termite") ||
    txt.includes("tiffin") || txt.includes("cook") || txt.includes("maid") || txt.includes("house help") ||
    txt.includes("packers") || txt.includes("movers") || txt.includes("house shifting") || txt.includes("shifting") ||
    txt.includes("deep cleaning") || txt.includes("house cleaning") || txt.includes("sofa cleaning") || txt.includes("bathroom cleaning") || txt.includes("sanitization") ||
    txt.includes("laundry") || txt.includes("dry cleaning") ||
    txt.includes("gardening") || txt.includes("lawn") ||
    txt.includes("cctv") || txt.includes("security system") ||
    txt.includes("solar") || txt.includes("solar panel") ||
    txt.includes("chimney") ||
    txt.includes("plumbing") || txt.includes("plumber") || txt.includes("pipe leak") || txt.includes("tap repair");

  if (isUnlistedService) {
    return res.status(200).json({
      serviceType: "Unknown",
      issueDetails: "Unlisted or out-of-scope home service requested",
      confidence: 100,
      nextQuestion: "क्षमा करें, अभी हम इस सर्विस के लिए उपलब्ध नहीं हैं, लेकिन जल्द ही इंदौर में यह सर्विस शुरू करेंगे और आपको तुरंत इन्फॉर्म कर देंगे! 🚀",
      isReadyToBook: false,
      quickActions: isHindiRequest ? [
        { label: "AC सर्विसेज देखें", action: "AC सर्विसेज देखें" },
        { label: "एप्लायंसेज रिपेयर देखें", action: "एप्लायंसेज रिपेयर देखें" },
        { label: "एजेंट से बात करें", action: "एजेंट से बात करें" }
      ] : [
        { label: "View AC Services", action: "View AC Services" },
        { label: "View Appliances Repair", action: "View Appliances Repair" },
        { label: "Talk to Human Agent", action: "Talk to Human Agent" }
      ]
    });
  }

  // 4. Quick Action Exploration Handlers
  if (
    cleanMessage.includes("view ac services") || 
    cleanMessage === "ac services" || 
    cleanMessage.includes("ac सर्विसेज देखें") || 
    cleanMessage.includes("एसी सर्विस") || 
    cleanMessage.includes("ac सर्विस")
  ) {
    return res.status(200).json({
      serviceType: "AC Repair",
      issueDetails: "Browsing AC services catalog",
      confidence: 100,
      nextQuestion: isHindiRequest 
        ? "Zomindia इंदौर में certified AC Services के लिए आपकी पहली पसंद है! यहाँ हमारी उपलब्ध AC सर्विस पैकेज हैं:" 
        : "Zomindia is Indore's top choice for certified AC Services! Here are our available AC service packages:",
      isReadyToBook: false,
      quickActions: isHindiRequest ? [
        { label: "स्प्लिट AC सर्विस बुक करें (₹770)", action: "स्प्लिट AC SERVICE BOOK KAREN" },
        { label: "विंडो AC सर्विस बुक करें (₹599)", action: "विंडो AC SERVICE BOOK KAREN" }
      ] : [
        { label: "Book Split AC Service (₹770)", action: "Book Split AC Service" },
        { label: "Book Window AC Service (₹599)", action: "Book Window AC Service" }
      ]
    });
  }

  if (
    cleanMessage.includes("view appliances repair") || 
    cleanMessage === "appliances repair" || 
    cleanMessage.includes("एप्लायंसेज रिपेयर देखें") || 
    cleanMessage.includes("होम एप्लायंसेज")
  ) {
    return res.status(200).json({
      serviceType: "Washing Machine Repair",
      issueDetails: "Browsing home appliances repair catalog",
      confidence: 100,
      nextQuestion: isHindiRequest 
        ? "हम इंदौर में प्रमुख होम एप्लायंसेज की टॉप-नॉच रिपेयर और सर्विसिंग प्रदान करते हैं:" 
        : "We offer top-notch repair & servicing for key home appliances in Indore:",
      isReadyToBook: false,
      quickActions: isHindiRequest ? [
        { label: "वाशिंग मशीन सर्विस बुक करें (₹499)", action: "वाशिंग मशीन सर्विस बुक करें" },
        { label: "आरओ फ़िल्टर सर्विस बुक करें (₹399)", action: "आरओ फ़िल्टर सर्विस बुक करें" }
      ] : [
        { label: "Book Washing Machine Service (₹499)", action: "Book Washing Machine Service" },
        { label: "Book RO Filter Service (₹399)", action: "Book RO Filter Service" }
      ]
    });
  }

  if (
    cleanMessage.includes("talk to human agent") || 
    cleanMessage.includes("human agent") || 
    cleanMessage.includes("human support") || 
    cleanMessage.includes("एजेंट से बात करें") || 
    cleanMessage.includes("बात करें")
  ) {
    return res.status(200).json({
      serviceType: "Unknown",
      issueDetails: "Customer requested human support agent",
      confidence: 100,
      nextQuestion: isHindiRequest 
        ? "हमारी सहायता टीम आपकी मदद के लिए उपलब्ध है! आप चैट के ऊपर दिए गए बटन से व्हाट्सएप या कॉल हेल्पलाइन पर सीधे बात कर सकते हैं।" 
        : "Our dedicated support team is available to assist you! You can chat directly with our team on WhatsApp or call our support helpline directly using the buttons at the top of this chat.",
      isReadyToBook: false,
      quickActions: isHindiRequest ? [
        { label: "स्प्लिट AC सर्विस बुक करें (₹770)", action: "स्प्लिट AC सर्विस बुक करें" },
        { label: "वाशिंग मशीन सर्विस बुक करें (₹499)", action: "वाशिंग मशीन सर्विस बुक करें" }
      ] : [
        { label: "Book Split AC Service (₹770)", action: "Book Split AC Service" },
        { label: "Book Washing Machine Service (₹499)", action: "Book Washing Machine Service" }
      ]
    });
  }

  // 5. Direct Quick Action Booking Interceptions
  if (
    cleanMessage.includes("book split ac") || cleanMessage.includes("book window ac") || 
    cleanMessage.includes("book washing machine") || cleanMessage.includes("book ro filter") ||
    cleanMessage.includes("स्प्लिट ac") || cleanMessage.includes("विंडो ac") || 
    cleanMessage.includes("वाशिंग मशीन") || cleanMessage.includes("आरओ") || cleanMessage.includes("ro filter")
  ) {
    const catName = (cleanMessage.includes("split ac") || cleanMessage.includes("स्प्लिट ac")) ? "Split AC Service" : 
                    (cleanMessage.includes("window ac") || cleanMessage.includes("विंडो ac")) ? "Window AC Service" : 
                    (cleanMessage.includes("washing machine") || cleanMessage.includes("वाशिंग मशीन")) ? "Washing Machine Service" : "RO Filter Service";
    if (isGuest) {
      return res.status(200).json({
        serviceType: catName,
        issueDetails: `Direct booking request for ${catName}`,
        confidence: 100,
        nextQuestion: isHindiRequest
          ? `मैं आपकी ${catName} बुक करने के लिए तैयार हूँ। कृपया पहले ऊपर दिए गए लॉगिन बटन पर क्लिक करें ताकि हम इसे आपके मोबाइल नंबर से लिंक कर सकें!`
          : `I am completely ready to book your ${catName}. Please click the Login button above first so we can securely link this to your mobile number and assign your Elite Partner instantly!`,
        isReadyToBook: false
      });
    }

    return res.status(200).json({
      serviceType: catName,
      issueDetails: `Direct quick action booking for ${catName}`,
      confidence: 100,
      nextQuestion: isHindiRequest ? "कृपया अपनी बुकिंग पूरी करने के लिए भुगतान का विकल्प चुनें:" : "Please choose your payment option to complete your booking:",
      isReadyToBook: true
    });
  }

  // 6. Attempt Gemini AI Response
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (apiKey.trim()) {
    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });

      let chatTranscript = "";
      if (context && Array.isArray(context.chatHistory) && context.chatHistory.length > 0) {
        chatTranscript = context.chatHistory.map((m: any) => `${m.role === "ai" ? "Zomini (AI)" : "User"}: ${m.text}`).join("\n");
      } else {
        chatTranscript = `User: ${message}`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Context: ${JSON.stringify(context || {})}\n\nCONVERSATION HISTORY:\n${chatTranscript}\n\nLatest User Message: ${message}`,
        config: {
          systemInstruction: `You are Zomini, the intelligent conversational lifecycle assistant for Zomindia. Your sole responsibility is to interact with users, diagnose their home service issues, and collect precise structured intent.

TARGET HOUSEHOLD SERVICES (Strict Boundaries):
1. "AC Repair" (e.g., cooling issues, gas leak, water leakage, strange noises)
2. "Washing Machine Repair" (e.g., spin issue, water drainage, noise, motor issue)
3. "RO Service" (e.g., filter replacement, low water flow, bad taste)
4. "Electrician" (e.g., short circuits, faulty switches, light installations)
5. "Carpenter" (e.g., furniture repair, door fixing, wooden installations)

REPETITIVE GREETING PREVENTION:
- NEVER repeat your full initial greeting ("Namaste ... I am Zomini ...") if conversation history exists.

OUTPUT FORMAT PROTOCOL:
You MUST respond strictly in a single, valid JSON object matching the schema.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              serviceType: {
                type: Type.STRING,
                description: "One of: 'AC Repair', 'Washing Machine Repair', 'RO Service', 'Electrician', 'Carpenter', 'Unknown'"
              },
              issueDetails: {
                type: Type.STRING,
                description: "A concise, clear English summary of the specific problem diagnosed"
              },
              confidence: {
                type: Type.INTEGER,
                description: "Confidence level of classification, integer between 0 and 100"
              },
              nextQuestion: {
                type: Type.STRING,
                description: "Your next conversational question or response written in the mirrored language"
              },
              isReadyToBook: {
                type: Type.BOOLEAN,
                description: "Set to true the moment the customer explicitly agrees to proceed with the service"
              },
              quickActions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    action: { type: Type.STRING }
                  },
                  required: ["label", "action"]
                }
              }
            },
            required: ["serviceType", "issueDetails", "confidence", "nextQuestion", "isReadyToBook"]
          }
        }
      });

      let responseText = response.text || "";
      if (responseText.startsWith("```")) {
        responseText = responseText.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
      }
      const parsedJson = JSON.parse(responseText);

      // Validate service type
      const STRICT_SERVICES = ["AC Repair", "Washing Machine Repair", "Electrician", "Carpenter", "RO Service"];
      if (parsedJson && parsedJson.serviceType && parsedJson.serviceType !== "Unknown") {
        if (!STRICT_SERVICES.includes(parsedJson.serviceType)) {
          parsedJson.serviceType = "Unknown";
          parsedJson.isReadyToBook = false;
        }
      }

      // Guest blocker
      if (isGuest && parsedJson.isReadyToBook === true) {
        parsedJson.isReadyToBook = false;
        const category = parsedJson.serviceType && parsedJson.serviceType !== "Unknown" ? parsedJson.serviceType : "home service";
        parsedJson.nextQuestion = isHindiRequest
          ? `मैं आपकी ${category} बुक करने के लिए तैयार हूँ। कृपया पहले ऊपर दिए गए लॉगिन बटन पर क्लिक करें!`
          : `I am completely ready to book your ${category}. Please click the Login button above first so we can securely link this to your mobile number and assign your Elite Partner instantly!`;
      }

      return res.status(200).json(parsedJson);
    } catch (geminiErr: any) {
      console.warn("[Vercel Zomini] Gemini API bypassed/failed:", geminiErr?.message || geminiErr);
    }
  }

  // 7. Rule-Based Fallback Engine
  let detectedServiceType: "AC Repair" | "Washing Machine Repair" | "Electrician" | "Carpenter" | "RO Service" | "Unknown" = "Unknown";
  let detectedIssueDetails = "";
  let detectedIsReadyToBook = false;
  let quickActionsList: { label: string; action: string }[] | undefined = undefined;

  if (txt.includes("ac") || txt.includes("cooling") || txt.includes("thanda") || txt.includes("thandha") || txt.includes("leakage") || txt.includes("noise") || txt.includes("compressor") || txt.includes("gas") || txt.includes("पानी") || txt.includes("tapak")) {
    detectedServiceType = "AC Repair";
    detectedIssueDetails = "AC repair or cooling/leakage issue requested";
    quickActionsList = isHindiRequest ? [
      { label: "स्प्लिट AC सर्विस बुक करें (₹770)", action: "स्प्लिट AC सर्विस बुक करें" },
      { label: "विंडो AC सर्विस बुक करें (₹599)", action: "विंडो AC सर्विस बुक करें" }
    ] : [
      { label: "Book Split AC Service (₹770)", action: "Book Split AC Service" },
      { label: "Book Window AC Service (₹599)", action: "Book Window AC Service" }
    ];
  } else if (txt.includes("washing machine") || txt.includes("spin") || txt.includes("drainage") || txt.includes("कपड़े")) {
    detectedServiceType = "Washing Machine Repair";
    detectedIssueDetails = "Washing machine repair requested";
    quickActionsList = isHindiRequest ? [
      { label: "वाशिंग मशीन सर्विस बुक करें (₹499)", action: "वाशिंग मशीन सर्विस बुक करें" }
    ] : [
      { label: "Book Washing Machine Service (₹499)", action: "Book Washing Machine Service" }
    ];
  } else if (txt.includes("electr") || txt.includes("short circuit") || txt.includes("switch") || txt.includes("wire") || txt.includes("light") || txt.includes("socket") || txt.includes("बिजली")) {
    detectedServiceType = "Electrician";
    detectedIssueDetails = "Electrical service requested";
  } else if (txt.includes("carp") || txt.includes("wood") || txt.includes("furniture") || txt.includes("door") || txt.includes("table") || txt.includes("sofa") || txt.includes("लकड़ी")) {
    detectedServiceType = "Carpenter";
    detectedIssueDetails = "Carpentry service requested";
  } else if (txt.includes("ro") || txt.includes("purifier") || txt.includes("filter") || txt.includes("water") || txt.includes("flow") || txt.includes("taste") || txt.includes("फ़िल्टर")) {
    detectedServiceType = "RO Service";
    detectedIssueDetails = "RO water purifier service requested";
    quickActionsList = isHindiRequest ? [
      { label: "आरओ फ़िल्टर सर्विस बुक करें (₹399)", action: "आरओ फ़िल्टर सर्विस बुक करें" }
    ] : [
      { label: "Book RO Filter Service (₹399)", action: "Book RO Filter Service" }
    ];
  }

  const replyMessage = isHindiRequest
    ? `नमस्ते ${userName}! मैं ZOMINI हूँ। मैं आपकी ${detectedServiceType !== "Unknown" ? detectedServiceType : "घरेलू समस्या"} में मदद कर सकती हूँ। क्या आप तुरंत टेक्नीशियन बुक करना चाहेंगे?`
    : `Hello ${userName}! I am ZOMINI. I can help with your ${detectedServiceType !== "Unknown" ? detectedServiceType : "home service issue"}. Would you like to schedule a technician now?`;

  return res.status(200).json({
    serviceType: detectedServiceType,
    issueDetails: detectedIssueDetails || "Query from customer",
    confidence: 100,
    nextQuestion: replyMessage,
    isReadyToBook: detectedIsReadyToBook,
    quickActions: quickActionsList
  });
}
