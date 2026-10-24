use serde::{Deserialize, Serialize};
use std::{
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{mpsc, Mutex},
    time::Duration,
};
use tauri::Manager;

#[derive(Clone, Deserialize, Serialize)]
struct EngineSession {
    origin: String,
    token: String,
}

fn validate_session(session: EngineSession) -> Result<EngineSession, String> {
    let origin = url::Url::parse(&session.origin).map_err(|_| "Invalid local engine origin.")?;
    if origin.scheme() != "http"
        || !matches!(origin.host_str(), Some("127.0.0.1") | Some("localhost"))
        || !origin.username().is_empty()
        || origin.password().is_some()
        || origin.path() != "/"
        || origin.query().is_some()
        || origin.fragment().is_some()
        || session.token.len() < 32
        || session.token.len() > 256
    {
        return Err("Invalid local engine session.".into());
    }
    Ok(session)
}

struct EngineProcess {
    child: Mutex<Option<Child>>,
    session: EngineSession,
}
impl EngineProcess {
    fn stop(&self) {
        if let Ok(mut guard) = self.child.lock() {
            if let Some(mut child) = guard.take() {
                if let Some(mut input) = child.stdin.take() {
                    let _ = input.write_all(b"shutdown\n");
                }
                for _ in 0..100 {
                    if matches!(child.try_wait(), Ok(Some(_))) {
                        return;
                    }
                    std::thread::sleep(Duration::from_millis(100));
                }
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}
impl Drop for EngineProcess {
    fn drop(&mut self) {
        self.stop();
    }
}

fn start_engine(app: &tauri::App) -> Result<EngineProcess, Box<dyn std::error::Error>> {
    let runtime = if cfg!(debug_assertions) {
        std::env::var_os("HARDCASE_ENGINE_ROOT")
            .map(PathBuf::from)
            .ok_or("Use npm run desktop:dev to launch the development runtime.")?
    } else {
        app.path().resource_dir()?.join("hardcase-runtime")
    };
    // Windows resource paths can use the extended-length prefix. Node's entry
    // module resolver rejects that form on some drive/junction combinations.
    let runtime = dunce::simplified(&runtime).to_path_buf();
    let node = if cfg!(debug_assertions) {
        std::env::var_os("HARDCASE_NODE_BINARY")
            .map(PathBuf::from)
            .ok_or("Development Node runtime is unavailable.")?
    } else {
        runtime.join("node.exe")
    };
    let data = app.path().app_local_data_dir()?.join("engine");
    std::fs::create_dir_all(&data)?;
    let log = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(data.join("desktop-engine.log"))?;
    let mut command = Command::new(node);
    command
        .arg(runtime.join("scripts/desktop-engine.mjs"))
        .current_dir(&runtime)
        .env("ENGINE_DATA_DIR", &data)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::from(log));
    if !cfg!(debug_assertions) {
        command.env("PLAYWRIGHT_BROWSERS_PATH", runtime.join("browsers"));
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW: private backend process.
    }
    let mut child = command.spawn()?;
    let output = child
        .stdout
        .take()
        .ok_or("Engine startup pipe unavailable.")?;
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        let mut line = String::new();
        let result = BufReader::new(output).read_line(&mut line).map(|_| line);
        let _ = sender.send(result);
    });
    let session = receiver
        .recv_timeout(Duration::from_secs(20))
        .ok()
        .and_then(Result::ok)
        .filter(|line| line.len() <= 4096)
        .and_then(|line| serde_json::from_str::<EngineSession>(&line).ok())
        .and_then(|session| validate_session(session).ok());
    match session {
        Some(session) => Ok(EngineProcess {
            child: Mutex::new(Some(child)),
            session,
        }),
        None => {
            let _ = child.kill();
            let _ = child.wait();
            Err("The local engine could not start. See the private desktop-engine.log in the application data folder.".into())
        }
    }
}

// Only the native main window can receive the session. No caller-selected paths or shell commands.
#[tauri::command]
fn engine_session(state: tauri::State<'_, EngineProcess>) -> EngineSession {
    state.session.clone()
}

pub fn run() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let engine = start_engine(app)?;
            app.manage(engine);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![engine_session])
        .build(tauri::generate_context!())
        .expect("hardcase desktop runtime could not start");
    app.run(|handle, event| {
        if matches!(
            event,
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
        ) {
            handle.state::<EngineProcess>().stop();
        }
    });
}
