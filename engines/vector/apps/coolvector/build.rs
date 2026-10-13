//! Windows only: embed the app icon and version info (VERSIONINFO) into `coolvector.exe`.
//!
//! On every other target this does nothing. A missing resource compiler is a warning, so a
//! cross-compile from macOS or Linux still links, unless `COOLVECTOR_REQUIRE_WINRES=1` turns it into
//! an error (for release builds).

fn main() -> Result<(), String> {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=../../assets/app-icon/coolvector.ico");
    println!("cargo:rerun-if-env-changed=COOLVECTOR_REQUIRE_WINRES");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return Ok(());
    }
    let mut res = winresource::WindowsResource::new();
    res.set_icon("../../assets/app-icon/coolvector.ico")
        .set("ProductName", "CoolVector")
        .set("FileDescription", "CoolVector vector illustration editor")
        .set("CompanyName", "Learning Machines LLC")
        .set("LegalCopyright", "Copyright (c) the CoolVector authors. MIT OR Apache-2.0.")
        .set("OriginalFilename", "coolvector.exe")
        .set("InternalName", "coolvector");
    if let Err(e) = res.compile() {
        if std::env::var_os("COOLVECTOR_REQUIRE_WINRES").is_some() {
            return Err(format!("embedding Windows resources failed: {e}"));
        }
        println!("cargo:warning=coolvector.exe built without icon/version resources: {e}");
    }
    Ok(())
}
