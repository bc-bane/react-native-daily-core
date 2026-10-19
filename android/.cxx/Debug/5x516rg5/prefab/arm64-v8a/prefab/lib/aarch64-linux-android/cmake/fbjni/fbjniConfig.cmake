if(NOT TARGET fbjni::fbjni)
add_library(fbjni::fbjni SHARED IMPORTED)
set_target_properties(fbjni::fbjni PROPERTIES
    IMPORTED_LOCATION "/private/var/folders/97/ymb2mss157d6sgjg30gs0j8m0000gn/T/cursor-sandbox-cache/83d22ceafd4ad6008a38cde98d52e191/gradle/caches/9.4.1/transforms/00e9f838836fbc0e39e2c6aa6eaaebb6/transformed/fbjni-0.7.0/prefab/modules/fbjni/libs/android.arm64-v8a/libfbjni.so"
    INTERFACE_INCLUDE_DIRECTORIES "/private/var/folders/97/ymb2mss157d6sgjg30gs0j8m0000gn/T/cursor-sandbox-cache/83d22ceafd4ad6008a38cde98d52e191/gradle/caches/9.4.1/transforms/00e9f838836fbc0e39e2c6aa6eaaebb6/transformed/fbjni-0.7.0/prefab/modules/fbjni/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

