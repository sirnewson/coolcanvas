//! Windows only: embed the app icon and version info (VERSIONINFO) into `coolphoto.exe`.
//!
//! On every other target this does nothing. A missing resource compiler is a warning, so a
//! cross-compile from macOS or Linux still links, unless `COOLPHOTO_REQUIRE_WINRES=1` (set by the
//! release workflow) turns it into an error.

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=../../assets/app-icon/coolphoto.ico");
    println!("cargo:rerun-if-env-changed=COOLPHOTO_REQUIRE_WINRES");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return;
    }
    let mut res = winresource::WindowsResource::new();
    res.set_icon("../../assets/app-icon/coolphoto.ico")
        .set("ProductName", "CoolPhoto")
        .set("FileDescription", "CoolPhoto image editor")
        .set("CompanyName", "Learning Machines LLC")
        .set("LegalCopyright", "Copyright (c) the CoolPhoto authors. MIT OR Apache-2.0.")
        .set("OriginalFilename", "coolphoto.exe")
        .set("InternalName", "coolphoto");
    if let Err(e) = res.compile() {
        if std::env::var_os("COOLPHOTO_REQUIRE_WINRES").is_some() {
            panic!("embedding Windows resources failed: {e}");
        }
        println!("cargo:warning=coolphoto.exe built without icon/version resources: {e}");
    }
}
