-- 問卷改成多題、多種題型。只新增欄位，不更動既有公告與回覆。
-- surveyQuestions：題目 JSON；為 NULL 時沿用舊的 surveyQuestion / surveyOptions
ALTER TABLE "Announcement" ADD COLUMN "surveyQuestions" TEXT;
-- answers：每題的答案 JSON；為 NULL 表示舊版回覆（只有 name / answer / note）
ALTER TABLE "SurveyResponse" ADD COLUMN "answers" TEXT;
-- respondentKey：學號（沒有學號題時用姓名），同一人在同一裝置重填時覆蓋舊回覆
ALTER TABLE "SurveyResponse" ADD COLUMN "respondentKey" TEXT;
CREATE INDEX "SurveyResponse_respondent_idx" ON "SurveyResponse" ("announcementId", "respondentKey");
