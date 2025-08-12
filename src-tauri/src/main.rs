#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};           // Manager is needed for app.path().app_config_dir()

// ---------- file storage for API key ----------
fn key_path(app: &AppHandle) -> PathBuf {
  let dir = app.path().app_config_dir().expect("config dir");
  let _ = fs::create_dir_all(&dir);
  dir.join("openai_key.txt")
}

#[tauri::command]
fn save_api_key(app: AppHandle, key: String) -> Result<(), String> {
  let p = key_path(&app);
  fs::write(p, key).map_err(|e| e.to_string())
}

fn read_api_key(app: &AppHandle) -> Option<String> {
  let p = key_path(app);
  fs::read_to_string(p).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

// ---------- challenge spec ----------
#[derive(Deserialize)]
struct SpecReq {
  title: String,
  tasks: Vec<String>,
  level: Option<String>,
  model: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct Rubric {
  min_sentences: Option<u32>,
  require_example: Option<bool>,
  key_points: Option<Vec<String>>,
}

#[derive(Serialize)]
struct SpecRes {
  requirements: Vec<String>,
  rubric: Rubric,
}

#[tauri::command]
async fn generate_challenge_spec(app: AppHandle, payload: SpecReq) -> Result<SpecRes, String> {
  let key = read_api_key(&app).ok_or("OpenAI API key not set in Settings")?;
  let level = payload.level.unwrap_or_else(|| "beginner".into());
  let model = payload.model.unwrap_or_else(|| "gpt-4o-mini".into());

  let sys = r#"You are an expert AI tutor creating node-specific challenge requirements.
Return ONLY JSON like:
{
  "requirements": ["...","...","..."],
  "rubric": { "min_sentences": number, "require_example": true|false, "key_points": ["...", "..."] }
}
Keep requirements 3-6 bullet points, concrete, and tied to the provided tasks."#;

  let user = serde_json::json!({
    "title": payload.title,
    "level": level,
    "tasks": payload.tasks
  }).to_string();

  let body = serde_json::json!({
    "model": model,
    "messages": [
      {"role":"system","content":sys},
      {"role":"user","content":user}
    ],
    "temperature": 0.3,
    "response_format": { "type": "json_object" }
  });

  let client = reqwest::Client::new();
  let resp = client
    .post("https://api.openai.com/v1/chat/completions")
    .bearer_auth(key)
    .json(&body)
    .send()
    .await
    .map_err(|e| e.to_string())?;

  if !resp.status().is_success() {
    let status = resp.status();
    let t = resp.text().await.unwrap_or_default();
    return Err(format!("OpenAI error: {} {}", status, t));
  }

  #[derive(Deserialize)] struct ChatChoiceMsg { content: Option<String> }
  #[derive(Deserialize)] struct ChatChoice { message: ChatChoiceMsg }
  #[derive(Deserialize)] struct ChatResp { choices: Vec<ChatChoice> }

  let data: ChatResp = resp.json().await.map_err(|e| e.to_string())?;
  let content = data.choices.get(0).and_then(|c| c.message.content.as_ref()).cloned()
    .ok_or("No content")?;

  let v: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
  let requirements = v.get("requirements")
    .and_then(|r| r.as_array())
    .map(|arr| arr.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
    .unwrap_or_else(|| vec!["Explain the concept clearly.".into(), "Provide a concrete example.".into()]);
  let rubric = Rubric {
    min_sentences: v.get("rubric").and_then(|r| r.get("min_sentences")).and_then(|x| x.as_u64()).map(|n| n as u32),
    require_example: v.get("rubric").and_then(|r| r.get("require_example")).and_then(|x| x.as_bool()),
    key_points: v.get("rubric").and_then(|r| r.get("key_points")).and_then(|x| x.as_array()).map(|arr|
      arr.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect()
    ),
  };

  Ok(SpecRes { requirements, rubric })
}

// ---------- other commands ----------
#[tauri::command] fn ping() -> &'static str { "pong" }

#[derive(Deserialize)]
struct ChallengeReq {
  node_id: String,
  title: String,
  answer: String,
  model: Option<String>,
  rubric: Option<Rubric>,
}
#[derive(Serialize)]
struct ChallengeRes { passed: bool, feedback: String }

#[tauri::command]
async fn submit_challenge(app: AppHandle, payload: ChallengeReq) -> Result<ChallengeRes, String> {
  let key = read_api_key(&app).ok_or("OpenAI API key not set in Settings")?;

  let rubric = payload.rubric.unwrap_or(Rubric {
    min_sentences: Some(3),
    require_example: Some(true),
    key_points: None,
  });

  let sys = r#"You are a strict evaluator. Return ONLY JSON like:
{ "passed": boolean, "feedback": "short explanation" }"#;

  let mut rubric_lines = vec![
    format!("Minimum sentences: {}", rubric.min_sentences.unwrap_or(3)),
    format!("Require example: {}", rubric.require_example.unwrap_or(true)),
  ];
  if let Some(keys) = &rubric.key_points {
    if !keys.is_empty() {
      rubric_lines.push(format!("Key points to hit: {}", keys.join(", ")));
    }
  }

  let user = format!(
    "Evaluate the answer for node '{}' ({}).\nRubric:\n{}\n\nAnswer:\n{}",
    payload.node_id, payload.title, rubric_lines.join("\n"), payload.answer
  );

  let body = serde_json::json!({
    "model": payload.model.unwrap_or_else(|| "gpt-4o-mini".to_string()),
    "messages": [
      {"role":"system","content":sys},
      {"role":"user","content":user}
    ],
    "temperature": 0.2,
    "response_format": { "type": "json_object" }
  });

  let client = reqwest::Client::new();
  let resp = client
    .post("https://api.openai.com/v1/chat/completions")
    .bearer_auth(key)
    .json(&body)
    .send()
    .await
    .map_err(|e| e.to_string())?;

  if !resp.status().is_success() {
    let status = resp.status();
    let t = resp.text().await.unwrap_or_default();
    return Err(format!("OpenAI error: {} {}", status, t));
  }

  #[derive(Deserialize)] struct ChatChoiceMsg { content: Option<String> }
  #[derive(Deserialize)] struct ChatChoice { message: ChatChoiceMsg }
  #[derive(Deserialize)] struct ChatResp { choices: Vec<ChatChoice> }

  let data: ChatResp = resp.json().await.map_err(|e| e.to_string())?;
  let content = data
    .choices
    .get(0)
    .and_then(|c| c.message.content.as_ref())
    .cloned()
    .ok_or_else(|| "No content".to_string())?;

  let parsed: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
  let passed = parsed.get("passed").and_then(|v| v.as_bool()).unwrap_or(false);
  let feedback = parsed.get("feedback").and_then(|v| v.as_str()).unwrap_or("No feedback").to_string();

  Ok(ChallengeRes { passed, feedback })
}

// ---------- app entry ----------
fn main() {
  tauri::Builder::default()
    .plugin(
      tauri_plugin_log::Builder::default()   // <- simpler: no Target/TargetKind
        .level(log::LevelFilter::Debug)
        .build()
    )
    .invoke_handler(tauri::generate_handler![
      save_api_key,
      ping,
      generate_challenge_spec,
      submit_challenge
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

