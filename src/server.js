const express = require("express");
const path = require("path");
const {
    createClient
} = require("@supabase/supabase-js");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error("❌ ไม่พบ SUPABASE_URL หรือ SUPABASE_SECRET_KEY");
    process.exit(1);
}

// Client สำหรับงานฝั่ง server
// ห้ามส่ง key นี้ไปให้ browser
const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// Client สำหรับ login ของ user
// ใช้ Supabase URL + secret key ได้ แต่จะไม่ persist session
const authClient = createClient(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);


/* =========================================================
   EXPRESS
========================================================= */

app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

app.use(express.static(
    path.join(__dirname, "..", "public")
));


/* =========================================================
   HELPER
========================================================= */

function cleanString(value) {
    return String(value ?? "").trim();
}

function numberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function validLatitude(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= -90 && n <= 90;
}

function validLongitude(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= -180 && n <= 180;
}

function distanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;

    const dLat =
        (Number(lat2) - Number(lat1)) *
        Math.PI /
        180;

    const dLng =
        (Number(lng2) - Number(lng1)) *
        Math.PI /
        180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(Number(lat1) * Math.PI / 180) *
        Math.cos(Number(lat2) * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;

    const c =
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}


/* =========================================================
   AUTHENTICATION
========================================================= */

/*
    อ่าน Bearer Token จาก request
*/
function getTokenFromRequest(req) {
    const authorization =
        req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
        return null;
    }

    return authorization.substring(7).trim();
}


/*
    ตรวจสอบ user จาก access token
*/
async function requireAuth(req, res, next) {
    try {
        const token = getTokenFromRequest(req);

        if (!token) {
            return res.status(401).json({
                error: "กรุณาเข้าสู่ระบบ"
            });
        }

        const {
            data,
            error
        } = await supabase.auth.getUser(token);

        if (error || !data.user) {
            return res.status(401).json({
                error: "Session หมดอายุหรือไม่ถูกต้อง"
            });
        }

        req.user = data.user;

        next();

    } catch (error) {
        console.error("AUTH ERROR:", error);

        return res.status(401).json({
            error: "ไม่สามารถตรวจสอบผู้ใช้ได้"
        });
    }
}


/*
    ดึง profile ของ user
*/
async function getProfile(userId) {
    const {
        data,
        error
    } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        throw new Error(
            "ไม่สามารถอ่านข้อมูล profile: " +
            error.message
        );
    }

    return data;
}


/* =========================================================
   GROUP SHAPING
========================================================= */

const GROUP_STATUS_LABELS = {
    forming: "กำลังรวมกลุ่ม",
    sent_to_driver: "ส่งงานให้คนขับแล้ว",
    accepted: "คนขับรับงานแล้ว",
    completed: "เดินทางเสร็จแล้ว",
    cancelled: "ยกเลิก"
};

const RIDE_STATUS_LABELS = {
    searching: "กำลังค้นหา",
    matched: "จับคู่แล้ว",
    sent_to_driver: "ส่งงานให้คนขับแล้ว",
    accepted: "คนขับรับงานแล้ว",
    completed: "เดินทางเสร็จแล้ว",
    cancelled: "ยกเลิก"
};

/*
    ดึงกลุ่มพร้อมสมาชิก/ผู้โดยสาร/คำขอเดินทาง/เส้นทาง
*/
async function getGroupWithRelations(groupId) {
    const {
        data: group,
        error
    } = await supabase
        .from("ride_groups")
        .select(`
            *,
            ride_group_members (
                id,
                group_id,
                ride_request_id,
                passenger_id,
                party_size,
                confirmed,
                joined_at,
                profiles (
                    id,
                    name,
                    phone,
                    role
                ),
                ride_requests (
                    id,
                    origin_text,
                    destination_text,
                    origin_detail,
                    destination_detail,
                    origin_lat,
                    origin_lng,
                    destination_lat,
                    destination_lng,
                    target_passengers,
                    status
                )
            ),
            ride_routes (
                id,
                distance_meters,
                duration_seconds,
                geometry
            )
        `)
        .eq("id", groupId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return group;
}

/*
    แปลงข้อมูลกลุ่มให้ตรงรูปแบบที่ client ใช้
*/
async function shapeGroup(group) {
    if (!group) {
        return null;
    }

    const members =
        (group.ride_group_members || []).map(
            (member) => ({
                id: member.id,
                passenger_id: member.passenger_id,
                party_size: member.party_size,
                confirmed: member.confirmed,
                passenger: member.profiles || null,
                ride: member.ride_requests || null
            })
        );

    const actualPassengers =
        members.reduce(
            (total, member) =>
                total + Number(member.party_size || 1),
            0
        );

    let driver = null;

    if (group.driver_id) {
        const {
            data: driverProfile
        } = await supabase
            .from("profiles")
            .select("id, name, phone, role, vehicle_seats")
            .eq("id", group.driver_id)
            .maybeSingle();

        driver = driverProfile || null;
    }

    const routeRow =
        Array.isArray(group.ride_routes)
            ? group.ride_routes[0]
            : group.ride_routes;

    return {
        ...group,
        status_label:
            GROUP_STATUS_LABELS[group.status] ||
            group.status,
        actual_passengers: actualPassengers,
        members,
        driver,
        route: routeRow
            ? {
                  distance_meters:
                      routeRow.distance_meters,
                  duration_seconds:
                      routeRow.duration_seconds,
                  geometry: routeRow.geometry
              }
            : null
    };
}

/*
    คำนวณเส้นทางผ่านจุดรับ/ส่งของสมาชิก
    แล้วบันทึกลง ride_routes
*/
async function buildRouteForGroup(group) {
    try {
        const members =
            group.ride_group_members || [];

        const waypoints = [];

        for (const member of members) {
            const ride = member.ride_requests;

            if (!ride) {
                continue;
            }

            waypoints.push([
                ride.origin_lng,
                ride.origin_lat
            ]);
        }

        for (const member of members) {
            const ride = member.ride_requests;

            if (!ride) {
                continue;
            }

            waypoints.push([
                ride.destination_lng,
                ride.destination_lat
            ]);
        }

        if (waypoints.length < 2) {
            return null;
        }

        const coords =
            waypoints
                .map(
                    (point) =>
                        `${point[0]},${point[1]}`
                )
                .join(";");

        const response =
            await fetch(
                `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
            );

        const data =
            await response.json();

        const route =
            data.routes && data.routes[0];

        if (!route) {
            return null;
        }

        const row = {
            group_id: group.id,
            distance_meters: route.distance,
            duration_seconds: route.duration,
            geometry: route.geometry
        };

        await supabase
            .from("ride_routes")
            .upsert(row, {
                onConflict: "group_id"
            });

        return row;

    } catch (error) {
        console.error(
            "BUILD ROUTE ERROR:",
            error
        );

        return null;
    }
}


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", async (req, res) => {
    res.json({
        ok: true,
        message: "UP-Drive server is running"
    });
});


/* =========================================================
   REGISTER
========================================================= */

app.post("/api/auth/register", async (req, res) => {
    try {
        const name = cleanString(req.body.name);
        const phone = cleanString(req.body.phone);
        const email = cleanString(req.body.email).toLowerCase();
        const password = String(req.body.password || "");
        const role = cleanString(req.body.role);

        const vehicleSeats =
            Number(req.body.vehicle_seats || 4);


        /* -------------------------
           VALIDATION
        ------------------------- */

        if (!name) {
            return res.status(400).json({
                error: "กรุณากรอกชื่อ"
            });
        }

        if (!email) {
            return res.status(400).json({
                error: "กรุณากรอก Email"
            });
        }

        if (!password || password.length < 6) {
            return res.status(400).json({
                error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"
            });
        }

        if (
            role !== "passenger" &&
            role !== "driver"
        ) {
            return res.status(400).json({
                error: "ประเภทผู้ใช้ไม่ถูกต้อง"
            });
        }

        if (
            role === "driver" &&
            (
                !Number.isInteger(vehicleSeats) ||
                vehicleSeats < 1 ||
                vehicleSeats > 10
            )
        ) {
            return res.status(400).json({
                error: "จำนวนที่นั่งรถต้องอยู่ระหว่าง 1-10"
            });
        }


        /* -------------------------
           CREATE AUTH USER
        ------------------------- */

        const {
            data: authData,
            error: authError
        } = await supabase.auth.admin.createUser({
            email,
            password,

            // สมัครแล้วเข้าใช้งานได้เลย
            email_confirm: true,

            user_metadata: {
                name,
                phone,
                role
            }
        });

        if (authError) {
            console.error(
                "CREATE AUTH USER ERROR:",
                authError
            );

            return res.status(400).json({
                error: authError.message
            });
        }

        if (!authData.user) {
            return res.status(500).json({
                error: "สร้างบัญชีผู้ใช้ไม่สำเร็จ"
            });
        }

        const userId = authData.user.id;


        /* -------------------------
           CREATE / UPDATE PROFILE
           
           ใช้ UPSERT เพื่อป้องกัน
           duplicate key profiles_pkey
        ------------------------- */

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .upsert(
                {
                    id: userId,
                    name,
                    phone,
                    role,

                    vehicle_seats:
                        role === "driver"
                            ? vehicleSeats
                            : 4
                },
                {
                    onConflict: "id"
                }
            )
            .select()
            .single();


        if (profileError) {
            console.error(
                "PROFILE ERROR:",
                profileError
            );

            /*
                ถ้าสร้าง profile ไม่สำเร็จ
                ลบ Auth user ที่เพิ่งสร้าง
            */
            try {
                await supabase.auth.admin.deleteUser(
                    userId
                );
            } catch (deleteError) {
                console.error(
                    "ROLLBACK USER ERROR:",
                    deleteError
                );
            }

            return res.status(500).json({
                error:
                    "สร้างข้อมูลผู้ใช้ไม่สำเร็จ: " +
                    profileError.message
            });
        }


        /* -------------------------
           LOGIN ทันทีหลังสมัคร
        ------------------------- */

        const {
            data: loginData,
            error: loginError
        } = await authClient.auth.signInWithPassword({
            email,
            password
        });


        if (loginError) {
            /*
                สมัครสำเร็จแล้ว
                แต่ login อัตโนมัติไม่สำเร็จ
            */

            return res.json({
                message: "สมัครสมาชิกสำเร็จ",
                profile
            });
        }


        return res.status(201).json({
            message: "สมัครสมาชิกสำเร็จ",
            session: loginData.session,
            profile
        });

    } catch (error) {
        console.error(
            "REGISTER ERROR:",
            error
        );

        return res.status(500).json({
            error:
                error.message ||
                "สมัครสมาชิกไม่สำเร็จ"
        });
    }
});


/* =========================================================
   LOGIN
========================================================= */

app.post("/api/auth/login", async (req, res) => {
    try {
        const email =
            cleanString(req.body.email)
                .toLowerCase();

        const password =
            String(req.body.password || "");


        if (!email || !password) {
            return res.status(400).json({
                error: "กรุณากรอก Email และ Password"
            });
        }


        const {
            data,
            error
        } = await authClient.auth.signInWithPassword({
            email,
            password
        });


        if (error) {
            return res.status(401).json({
                error: error.message
            });
        }


        if (!data.user || !data.session) {
            return res.status(401).json({
                error: "เข้าสู่ระบบไม่สำเร็จ"
            });
        }


        const profile =
            await getProfile(data.user.id);


        return res.json({
            message: "เข้าสู่ระบบสำเร็จ",
            session: data.session,
            user: data.user,
            profile
        });

    } catch (error) {
        console.error(
            "LOGIN ERROR:",
            error
        );

        return res.status(500).json({
            error:
                error.message ||
                "เข้าสู่ระบบไม่สำเร็จ"
        });
    }
});


/* =========================================================
   CURRENT USER
========================================================= */

app.get(
    "/api/auth/me",
    requireAuth,
    async (req, res) => {

        try {
            const profile =
                await getProfile(req.user.id);

            return res.json({
                user: req.user,
                profile
            });

        } catch (error) {
            return res.status(500).json({
                error: error.message
            });
        }
    }
);


/* =========================================================
   LOGOUT
========================================================= */

app.post(
    "/api/auth/logout",
    requireAuth,
    async (req, res) => {

        /*
            Session อยู่ฝั่ง browser
            ดังนั้นให้ browser ลบ token เอง
        */

        return res.json({
            message: "ออกจากระบบสำเร็จ"
        });
    }
);


/* =========================================================
   GET PROFILE
========================================================= */

app.get(
    "/api/profile",
    requireAuth,
    async (req, res) => {

        try {
            const profile =
                await getProfile(req.user.id);

            if (!profile) {
                return res.status(404).json({
                    error: "ไม่พบข้อมูล profile"
                });
            }

            return res.json({
                profile
            });

        } catch (error) {
            return res.status(500).json({
                error: error.message
            });
        }
    }
);


/* =========================================================
   CREATE RIDE REQUEST
========================================================= */

app.post(
    "/api/rides",
    requireAuth,
    async (req, res) => {

        try {
            const profile =
                await getProfile(req.user.id);

            if (!profile) {
                return res.status(404).json({
                    error: "ไม่พบข้อมูลผู้ใช้"
                });
            }

            if (profile.role !== "passenger") {
                return res.status(403).json({
                    error:
                        "เฉพาะผู้โดยสารเท่านั้นที่สร้างคำขอเดินทางได้"
                });
            }


            const originText =
                cleanString(req.body.origin_text);

            const destinationText =
                cleanString(
                    req.body.destination_text
                );

            const originLat =
                numberOrNull(req.body.origin_lat);

            const originLng =
                numberOrNull(req.body.origin_lng);

            const destinationLat =
                numberOrNull(
                    req.body.destination_lat
                );

            const destinationLng =
                numberOrNull(
                    req.body.destination_lng
                );

            const originDetail =
                cleanString(req.body.origin_detail);

            const destinationDetail =
                cleanString(
                    req.body.destination_detail
                );

            const targetPassengers =
                Number(
                    req.body.target_passengers || 1
                );


            if (!originText) {
                return res.status(400).json({
                    error: "กรุณาระบุจุดรับ"
                });
            }

            if (!destinationText) {
                return res.status(400).json({
                    error: "กรุณาระบุปลายทาง"
                });
            }

            if (
                !validLatitude(originLat) ||
                !validLongitude(originLng)
            ) {
                return res.status(400).json({
                    error: "พิกัดจุดรับไม่ถูกต้อง"
                });
            }

            if (
                !validLatitude(destinationLat) ||
                !validLongitude(destinationLng)
            ) {
                return res.status(400).json({
                    error: "พิกัดปลายทางไม่ถูกต้อง"
                });
            }

            if (
                !Number.isInteger(targetPassengers) ||
                targetPassengers < 1 ||
                targetPassengers > 10
            ) {
                return res.status(400).json({
                    error:
                        "จำนวนผู้โดยสารต้องอยู่ระหว่าง 1-10 คน"
                });
            }


            /* =================================================
               1. สร้าง ride request
            ================================================= */

            const {
                data: request,
                error: requestError
            } = await supabase
                .from("ride_requests")
                .insert({
                    passenger_id: req.user.id,
                    origin_text: originText,
                    destination_text: destinationText,

                    origin_detail: originDetail,

                    destination_detail:
                        destinationDetail,

                    origin_lat: originLat,
                    origin_lng: originLng,

                    destination_lat:
                        destinationLat,
                    destination_lng:
                        destinationLng,

                    target_passengers:
                        targetPassengers,

                    status: "searching"
                })
                .select()
                .single();


            if (requestError) {
                return res.status(500).json({
                    error:
                        "สร้างคำขอเดินทางไม่สำเร็จ: " +
                        requestError.message
                });
            }


            /* =================================================
               2. หารถ/กลุ่มที่กำลังรวมคน
            ================================================= */

            const {
                data: candidates,
                error: candidateError
            } = await supabase
                .from("ride_requests")
                .select(`
                    *,
                    ride_groups (
                        *,
                        ride_group_members (
                            id,
                            passenger_id,
                            party_size,
                            confirmed
                        )
                    )
                `)
                .eq("status", "matched")
                .neq("passenger_id", req.user.id)
                .not("group_id", "is", null)
                .limit(100);


            if (candidateError) {
                console.error(
                    "MATCH QUERY ERROR:",
                    candidateError
                );

                return res.json({
                    message:
                        "สร้างคำขอสำเร็จ แต่ยังค้นหากลุ่มไม่สำเร็จ",
                    request
                });
            }


            /* =================================================
               3. หาคู่ที่ใกล้เคียง
            ================================================= */

            let bestCandidate = null;
            let bestScore = Infinity;

            for (const candidate of candidates || []) {

                if (
                    !candidate.ride_groups ||
                    !candidate.ride_groups[0]
                ) {
                    continue;
                }

                const group =
                    candidate.ride_groups[0];

                if (
                    group.status !== "forming"
                ) {
                    continue;
                }


                const pickupDistance =
                    distanceKm(
                        originLat,
                        originLng,
                        candidate.origin_lat,
                        candidate.origin_lng
                    );

                const destinationDistance =
                    distanceKm(
                        destinationLat,
                        destinationLng,
                        candidate.destination_lat,
                        candidate.destination_lng
                    );


                /*
                    เกณฑ์ MVP

                    จุดรับ <= 4 km
                    ปลายทาง <= 6 km

                    ยิ่งใกล้ยิ่งได้คะแนนดี
                */

                if (pickupDistance > 4) {
                    continue;
                }

                if (destinationDistance > 6) {
                    continue;
                }


                const score =
                    pickupDistance +
                    destinationDistance;


                if (score < bestScore) {
                    bestScore = score;

                    bestCandidate = {
                        request: candidate,
                        group
                    };
                }
            }


            /* =================================================
               4. ถ้าไม่เจอกลุ่ม -> สร้างกลุ่มใหม่
            ================================================= */

            if (!bestCandidate) {

                const {
                    data: group,
                    error: groupError
                } = await supabase
                    .from("ride_groups")
                    .insert({
                        leader_id: req.user.id,
                        target_passengers:
                            targetPassengers,
                        status: "forming"
                    })
                    .select()
                    .single();


                if (groupError) {
                    return res.status(500).json({
                        error:
                            "สร้างกลุ่มไม่สำเร็จ: " +
                            groupError.message
                    });
                }


                await supabase
                    .from("ride_requests")
                    .update({
                        group_id: group.id,
                        status: "matched"
                    })
                    .eq("id", request.id);


                const {
                    error: memberError
                } = await supabase
                    .from("ride_group_members")
                    .insert({
                        group_id: group.id,
                        ride_request_id: request.id,
                        passenger_id: req.user.id,
                        party_size: 1,
                        confirmed: false
                    });


                if (memberError) {
                    return res.status(500).json({
                        error:
                            "เพิ่มสมาชิกเข้ากลุ่มไม่สำเร็จ: " +
                            memberError.message
                    });
                }


                const shapedGroup =
                    await shapeGroup(
                        await getGroupWithRelations(
                            group.id
                        )
                    );

                return res.status(201).json({
                    message:
                        "สร้างคำขอและกลุ่มใหม่แล้ว",
                    ride: {
                        ...request,
                        group_id: group.id,
                        status: "matched"
                    },
                    request: {
                        ...request,
                        group_id: group.id,
                        status: "matched"
                    },
                    group: shapedGroup
                });
            }


            /* =================================================
               5. เข้ากลุ่มเดิม
            ================================================= */

            const group =
                bestCandidate.group;


            /*
                คำนวณจำนวนคนในกลุ่มปัจจุบัน
            */

            const members =
                group.ride_group_members || [];

            const currentPassengerCount =
                members.reduce(
                    (total, member) =>
                        total +
                        Number(
                            member.party_size || 1
                        ),
                    0
                );


            /*
                ถ้าเต็มตาม target แล้ว
                ไม่เข้ากลุ่มนี้
            */

            if (
                currentPassengerCount >=
                Number(group.target_passengers)
            ) {

                return res.status(201).json({
                    message:
                        "พบกลุ่มที่ใกล้เคียงแต่เต็มแล้ว",
                    request
                });
            }


            const {
                error: updateRequestError
            } = await supabase
                .from("ride_requests")
                .update({
                    group_id: group.id,
                    status: "matched"
                })
                .eq("id", request.id);


            if (updateRequestError) {
                return res.status(500).json({
                    error:
                        "เชื่อมคำขอกับกลุ่มไม่สำเร็จ"
                });
            }


            const {
                error: memberError
            } = await supabase
                .from("ride_group_members")
                .insert({
                    group_id: group.id,
                    ride_request_id: request.id,
                    passenger_id: req.user.id,
                    party_size: 1,
                    confirmed: false
                });


            if (memberError) {
                return res.status(500).json({
                    error:
                        "เพิ่มสมาชิกเข้ากลุ่มไม่สำเร็จ: " +
                        memberError.message
                });
            }


            const shapedGroup =
                await shapeGroup(
                    await getGroupWithRelations(
                        group.id
                    )
                );

            return res.status(201).json({
                message:
                    "พบกลุ่มที่ใกล้เคียงและเข้ากลุ่มแล้ว",
                ride: {
                    ...request,
                    group_id: group.id,
                    status: "matched"
                },
                request: {
                    ...request,
                    group_id: group.id,
                    status: "matched"
                },
                group: shapedGroup,
                group_id: group.id,
                distance_score: bestScore
            });

        } catch (error) {
            console.error(
                "CREATE RIDE ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    error.message ||
                    "สร้างคำขอเดินทางไม่สำเร็จ"
            });
        }
    }
);


/* =========================================================
   GET MY RIDES
========================================================= */

app.get(
    "/api/rides/my",
    requireAuth,
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await supabase
                .from("ride_requests")
                .select(`
                    *,
                    ride_groups (
                        *,
                        ride_group_members (
                            *,
                            profiles (
                                id,
                                name,
                                phone,
                                role
                            )
                        )
                    )
                `)
                .eq(
                    "passenger_id",
                    req.user.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


            if (error) {
                return res.status(500).json({
                    error: error.message
                });
            }


            return res.json({
                rides: data || []
            });

        } catch (error) {
            return res.status(500).json({
                error: error.message
            });
        }
    }
);


/* =========================================================
   GET ACTIVE RIDE (ผู้โดยสาร)
========================================================= */

app.get(
    "/api/rides/active",
    requireAuth,
    async (req, res) => {

        try {
            const {
                data: ride,
                error
            } = await supabase
                .from("ride_requests")
                .select("*")
                .eq(
                    "passenger_id",
                    req.user.id
                )
                .in("status", [
                    "searching",
                    "matched",
                    "sent_to_driver",
                    "accepted"
                ])
                .order("created_at", {
                    ascending: false
                })
                .limit(1)
                .maybeSingle();

            if (error) {
                return res.status(500).json({
                    error: error.message
                });
            }

            if (!ride) {
                return res.json({
                    ride: null,
                    group: null
                });
            }

            let group = null;

            if (ride.group_id) {
                group =
                    await shapeGroup(
                        await getGroupWithRelations(
                            ride.group_id
                        )
                    );
            }

            return res.json({
                ride,
                group
            });

        } catch (error) {
            return res.status(500).json({
                error: error.message
            });
        }
    }
);


/* =========================================================
   GET RIDE BY ID
========================================================= */

app.get(
    "/api/rides/:rideId",
    requireAuth,
    async (req, res) => {

        try {
            const {
                data: ride,
                error
            } = await supabase
                .from("ride_requests")
                .select("*")
                .eq("id", req.params.rideId)
                .maybeSingle();

            if (error) {
                return res.status(500).json({
                    error: error.message
                });
            }

            if (!ride) {
                return res.status(404).json({
                    error: "ไม่พบคำขอเดินทาง"
                });
            }

            if (ride.passenger_id !== req.user.id) {
                return res.status(403).json({
                    error:
                        "คุณไม่มีสิทธิ์ดูคำขอนี้"
                });
            }

            let group = null;

            if (ride.group_id) {
                group =
                    await shapeGroup(
                        await getGroupWithRelations(
                            ride.group_id
                        )
                    );
            }

            return res.json({
                ride,
                group
            });

        } catch (error) {
            return res.status(500).json({
                error: error.message
            });
        }
    }
);


/* =========================================================
   HISTORY
========================================================= */

app.get(
    "/api/history",
    requireAuth,
    async (req, res) => {

        try {
            const profile =
                await getProfile(req.user.id);

            if (!profile) {
                return res.status(404).json({
                    error: "ไม่พบข้อมูลผู้ใช้"
                });
            }

            if (profile.role === "driver") {
                const {
                    data: groups,
                    error
                } = await supabase
                    .from("ride_groups")
                    .select("*")
                    .eq(
                        "driver_id",
                        req.user.id
                    )
                    .order("created_at", {
                        ascending: false
                    })
                    .limit(50);

                if (error) {
                    return res.status(500).json({
                        error: error.message
                    });
                }

                const rides = [];

                for (const group of groups || []) {
                    rides.push(
                        await shapeGroup(
                            await getGroupWithRelations(
                                group.id
                            )
                        )
                    );
                }

                return res.json({
                    role: "driver",
                    rides
                });
            }

            const {
                data: rides,
                error
            } = await supabase
                .from("ride_requests")
                .select("*")
                .eq(
                    "passenger_id",
                    req.user.id
                )
                .order("created_at", {
                    ascending: false
                })
                .limit(50);

            if (error) {
                return res.status(500).json({
                    error: error.message
                });
            }

            return res.json({
                role: "passenger",
                rides: rides || []
            });

        } catch (error) {
            return res.status(500).json({
                error: error.message
            });
        }
    }
);


/* =========================================================
   DRIVER - UPDATE LOCATION
========================================================= */

app.post(
    "/api/driver/location",
    requireAuth,
    async (req, res) => {

        try {
            const profile =
                await getProfile(req.user.id);

            if (
                !profile ||
                profile.role !== "driver"
            ) {
                return res.status(403).json({
                    error:
                        "เฉพาะคนขับเท่านั้น"
                });
            }

            const latitude =
                Number(req.body.latitude);

            const longitude =
                Number(req.body.longitude);

            if (
                !validLatitude(latitude) ||
                !validLongitude(longitude)
            ) {
                return res.status(400).json({
                    error: "พิกัดไม่ถูกต้อง"
                });
            }

            const {
                error
            } = await supabase
                .from("driver_locations")
                .upsert(
                    {
                        driver_id: req.user.id,
                        latitude,
                        longitude,
                        heading: numberOrNull(
                            req.body.heading
                        ),
                        speed: numberOrNull(
                            req.body.speed
                        ),
                        accuracy: numberOrNull(
                            req.body.accuracy
                        ),
                        updated_at:
                            new Date().toISOString()
                    },
                    {
                        onConflict: "driver_id"
                    }
                );

            if (error) {
                return res.status(500).json({
                    error: error.message
                });
            }

            return res.json({
                ok: true
            });

        } catch (error) {
            return res.status(500).json({
                error: error.message
            });
        }
    }
);


/* =========================================================
   GET GROUP
========================================================= */

app.get(
    "/api/groups/:groupId",
    requireAuth,
    async (req, res) => {

        try {

            const groupId =
                req.params.groupId;


            const group =
                await getGroupWithRelations(
                    groupId
                );


            if (!group) {
                return res.status(404).json({
                    error: "ไม่พบกลุ่ม"
                });
            }


            const isMember =
                group.ride_group_members
                    ?.some(
                        member =>
                            member.passenger_id ===
                            req.user.id
                    );

            const isLeader =
                group.leader_id ===
                req.user.id;

            const isDriver =
                group.driver_id ===
                req.user.id;


            if (
                !isMember &&
                !isLeader &&
                !isDriver
            ) {
                return res.status(403).json({
                    error:
                        "คุณไม่มีสิทธิ์ดูข้อมูลกลุ่มนี้"
                });
            }


            return res.json({
                group: await shapeGroup(group)
            });

        } catch (error) {
            return res.status(500).json({
                error: error.message
            });
        }
    }
);


/* =========================================================
   CONFIRM MEMBER
========================================================= */

app.post(
    "/api/groups/:groupId/confirm",
    requireAuth,
    async (req, res) => {

        try {

            const groupId =
                req.params.groupId;


            const {
                data: member,
                error: memberError
            } = await supabase
                .from("ride_group_members")
                .select("*")
                .eq(
                    "group_id",
                    groupId
                )
                .eq(
                    "passenger_id",
                    req.user.id
                )
                .maybeSingle();


            if (
                memberError ||
                !member
            ) {
                return res.status(404).json({
                    error:
                        "คุณไม่ได้อยู่ในกลุ่มนี้"
                });
            }


            const {
                data: group,
                error: groupError
            } = await supabase
                .from("ride_groups")
                .select("*")
                .eq("id", groupId)
                .single();


            if (groupError || !group) {
                return res.status(404).json({
                    error: "ไม่พบกลุ่ม"
                });
            }


            if (
                group.status !== "forming"
            ) {
                return res.status(400).json({
                    error:
                        "กลุ่มนี้ไม่สามารถยืนยันได้แล้ว"
                });
            }


            /*
                ยืนยันสมาชิก
            */

            const {
                error: confirmError
            } = await supabase
                .from("ride_group_members")
                .update({
                    confirmed: true
                })
                .eq("id", member.id);


            if (confirmError) {
                return res.status(500).json({
                    error:
                        "ยืนยันสมาชิกไม่สำเร็จ"
                });
            }


            /*
                ดึงสมาชิกทั้งหมดใหม่
            */

            const {
                data: members,
                error: membersError
            } = await supabase
                .from("ride_group_members")
                .select(`
                    id,
                    passenger_id,
                    party_size,
                    confirmed
                `)
                .eq(
                    "group_id",
                    groupId
                );


            if (membersError) {
                return res.status(500).json({
                    error:
                        membersError.message
                });
            }


            const allConfirmed =
                members.length > 0 &&
                members.every(
                    m => m.confirmed === true
                );


            /*
                สำคัญ:
                ไม่ต้องรอ target_passengers เต็ม

                ถ้าคนปัจจุบันยืนยันครบ
                ส่งงานให้ driver ได้เลย
            */

            if (allConfirmed) {

                const {
                    error: groupUpdateError
                } = await supabase
                    .from("ride_groups")
                    .update({
                        status:
                            "sent_to_driver",
                        confirmed_at:
                            new Date().toISOString()
                    })
                    .eq("id", groupId)
                    .eq(
                        "status",
                        "forming"
                    );


                if (groupUpdateError) {
                    return res.status(500).json({
                        error:
                            "ส่งกลุ่มให้คนขับไม่สำเร็จ"
                    });
                }


                /*
                    update ride requests
                */

                await supabase
                    .from("ride_requests")
                    .update({
                        status:
                            "sent_to_driver"
                    })
                    .eq(
                        "group_id",
                        groupId
                    );


                /*
                    สร้างเส้นทางของกลุ่ม
                */

                const groupWithMembers =
                    await getGroupWithRelations(
                        groupId
                    );

                await buildRouteForGroup(
                    groupWithMembers
                );


                const shapedGroup =
                    await shapeGroup(
                        await getGroupWithRelations(
                            groupId
                        )
                    );

                return res.json({
                    message:
                        "สมาชิกยืนยันครบแล้ว ส่งงานให้คนขับได้",
                    all_confirmed: true,
                    status: "sent_to_driver",
                    group: shapedGroup
                });
            }


            const shapedGroup =
                await shapeGroup(
                    await getGroupWithRelations(
                        groupId
                    )
                );

            return res.json({
                message:
                    "ยืนยันเรียบร้อย รอสมาชิกคนอื่นยืนยัน",
                all_confirmed: false,
                status: "forming",
                group: shapedGroup
            });

        } catch (error) {
            console.error(
                "CONFIRM ERROR:",
                error
            );

            return res.status(500).json({
                error: error.message
            });
        }
    }
);


/* =========================================================
   DRIVER - GET AVAILABLE JOBS
========================================================= */

app.get(
    "/api/driver/jobs",
    requireAuth,
    async (req, res) => {

        try {

            const profile =
                await getProfile(req.user.id);


            if (!profile) {
                return res.status(404).json({
                    error: "ไม่พบข้อมูลผู้ใช้"
                });
            }


            if (profile.role !== "driver") {
                return res.status(403).json({
                    error:
                        "เฉพาะคนขับเท่านั้น"
                });
            }


            const {
                data: groups,
                error
            } = await supabase
                .from("ride_groups")
                .select(`
                    *,
                    ride_group_members (
                        *,
                        profiles (
                            id,
                            name,
                            phone,
                            role
                        ),
                        ride_requests (
                            id,
                            origin_text,
                            destination_text,
                            origin_detail,
                            destination_detail,
                            origin_lat,
                            origin_lng,
                            destination_lat,
                            destination_lng,
                            target_passengers,
                            status
                        )
                    )
                `)
                .or(
                    `status.eq.sent_to_driver,and(status.eq.accepted,driver_id.eq.${req.user.id})`
                )
                .order(
                    "confirmed_at",
                    {
                        ascending: true
                    }
                );


            if (error) {
                return res.status(500).json({
                    error: error.message
                });
            }


            /*
                กรองกลุ่มที่จำนวนคน
                ไม่เกินจำนวนที่นั่งรถ
            */

            const availableJobs = [];

            for (const group of groups || []) {
                const passengerCount =
                    (group.ride_group_members || [])
                        .reduce(
                            (
                                total,
                                member
                            ) =>
                                total +
                                Number(
                                    member.party_size ||
                                    1
                                ),
                            0
                        );

                if (
                    passengerCount <=
                    Number(
                        profile.vehicle_seats
                    )
                ) {
                    const fullGroup =
                        await getGroupWithRelations(
                            group.id
                        );

                    availableJobs.push(
                        await shapeGroup(
                            fullGroup
                        )
                    );
                }
            }


            return res.json({
                jobs: availableJobs
            });

        } catch (error) {
            console.error(
                "DRIVER JOB ERROR:",
                error
            );

            return res.status(500).json({
                error: error.message
            });
        }
    }
);


/* =========================================================
   DRIVER ACCEPT JOB
========================================================= */

app.post(
    "/api/driver/jobs/:groupId/accept",
    requireAuth,
    async (req, res) => {

        try {

            const profile =
                await getProfile(req.user.id);


            if (
                !profile ||
                profile.role !== "driver"
            ) {
                return res.status(403).json({
                    error:
                        "เฉพาะคนขับเท่านั้น"
                });
            }


            const groupId =
                req.params.groupId;


            const {
                data: group,
                error: groupError
            } = await supabase
                .from("ride_groups")
                .select(`
                    *,
                    ride_group_members (
                        party_size
                    )
                `)
                .eq(
                    "id",
                    groupId
                )
                .single();


            if (groupError || !group) {
                return res.status(404).json({
                    error: "ไม่พบงาน"
                });
            }


            if (
                group.status !==
                "sent_to_driver"
            ) {
                return res.status(400).json({
                    error:
                        "งานนี้ไม่สามารถรับได้แล้ว"
                });
            }


            const passengerCount =
                (group.ride_group_members || [])
                    .reduce(
                        (
                            total,
                            member
                        ) =>
                            total +
                            Number(
                                member.party_size ||
                                1
                            ),
                        0
                    );


            if (
                passengerCount >
                Number(profile.vehicle_seats)
            ) {
                return res.status(400).json({
                    error:
                        "จำนวนผู้โดยสารเกินจำนวนที่นั่งรถ"
                });
            }


            /*
                ป้องกัน driver สองคน
                รับงานเดียวกันพร้อมกัน
            */

            const {
                data: updatedGroup,
                error: updateError
            } = await supabase
                .from("ride_groups")
                .update({
                    status: "accepted",
                    driver_id: req.user.id,
                    accepted_at:
                        new Date().toISOString()
                })
                .eq(
                    "id",
                    groupId
                )
                .eq(
                    "status",
                    "sent_to_driver"
                )
                .select()
                .maybeSingle();


            if (updateError) {
                return res.status(500).json({
                    error:
                        updateError.message
                });
            }


            if (!updatedGroup) {
                return res.status(409).json({
                    error:
                        "งานนี้ถูกรับไปแล้ว"
                });
            }


            /*
                update ride requests
            */

            await supabase
                .from("ride_requests")
                .update({
                    status: "accepted"
                })
                .eq(
                    "group_id",
                    groupId
                );


            /*
                สร้างเส้นทางถ้ายังไม่มี
            */

            const {
                data: existingRoute
            } = await supabase
                .from("ride_routes")
                .select("id")
                .eq("group_id", groupId)
                .maybeSingle();

            if (!existingRoute) {
                const groupWithMembers =
                    await getGroupWithRelations(
                        groupId
                    );

                await buildRouteForGroup(
                    groupWithMembers
                );
            }


            return res.json({
                message:
                    "รับงานเรียบร้อย",
                group: updatedGroup
            });

        } catch (error) {
            console.error(
                "ACCEPT JOB ERROR:",
                error
            );

            return res.status(500).json({
                error: error.message
            });
        }
    }
);


/* =========================================================
   DRIVER COMPLETE JOB
========================================================= */

app.post(
    "/api/driver/jobs/:groupId/complete",
    requireAuth,
    async (req, res) => {

        try {

            const profile =
                await getProfile(req.user.id);


            if (
                !profile ||
                profile.role !== "driver"
            ) {
                return res.status(403).json({
                    error:
                        "เฉพาะคนขับเท่านั้น"
                });
            }


            const groupId =
                req.params.groupId;


            const {
                data: group,
                error
            } = await supabase
                .from("ride_groups")
                .select("*")
                .eq(
                    "id",
                    groupId
                )
                .single();


            if (error || !group) {
                return res.status(404).json({
                    error: "ไม่พบงาน"
                });
            }


            if (
                group.driver_id !==
                req.user.id
            ) {
                return res.status(403).json({
                    error:
                        "คุณไม่ใช่คนขับของงานนี้"
                });
            }


            if (
                group.status !==
                "accepted"
            ) {
                return res.status(400).json({
                    error:
                        "งานนี้ยังไม่อยู่ในสถานะกำลังเดินทาง"
                });
            }


            const {
                data: updatedGroup,
                error: updateError
            } = await supabase
                .from("ride_groups")
                .update({
                    status: "completed",
                    completed_at:
                        new Date().toISOString()
                })
                .eq(
                    "id",
                    groupId
                )
                .select()
                .single();


            if (updateError) {
                return res.status(500).json({
                    error:
                        updateError.message
                });
            }


            await supabase
                .from("ride_requests")
                .update({
                    status: "completed"
                })
                .eq(
                    "group_id",
                    groupId
                );


            return res.json({
                message:
                    "ปิดงานเรียบร้อย",
                group: updatedGroup
            });

        } catch (error) {
            return res.status(500).json({
                error: error.message
            });
        }
    }
);


/* =========================================================
   DRIVER CANCEL ACCEPTED JOB
========================================================= */

app.post(
    "/api/driver/jobs/:groupId/cancel",
    requireAuth,
    async (req, res) => {

        try {
            const profile =
                await getProfile(req.user.id);

            if (
                !profile ||
                profile.role !== "driver"
            ) {
                return res.status(403).json({
                    error:
                        "เฉพาะคนขับเท่านั้น"
                });
            }

            const groupId =
                req.params.groupId;

            const {
                data: group,
                error
            } = await supabase
                .from("ride_groups")
                .select("*")
                .eq("id", groupId)
                .single();

            if (error || !group) {
                return res.status(404).json({
                    error: "ไม่พบงาน"
                });
            }

            if (
                group.driver_id !==
                req.user.id
            ) {
                return res.status(403).json({
                    error:
                        "คุณไม่ใช่คนขับของงานนี้"
                });
            }

            if (
                group.status !==
                "accepted"
            ) {
                return res.status(400).json({
                    error:
                        "ยกเลิกได้เฉพาะงานที่รับแล้วเท่านั้น"
                });
            }

            const {
                data: updatedGroup,
                error: updateError
            } = await supabase
                .from("ride_groups")
                .update({
                    status: "sent_to_driver",
                    driver_id: null,
                    accepted_at: null
                })
                .eq("id", groupId)
                .eq("status", "accepted")
                .select()
                .maybeSingle();

            if (updateError) {
                return res.status(500).json({
                    error:
                        updateError.message
                });
            }

            if (!updatedGroup) {
                return res.status(409).json({
                    error:
                        "สถานะงานเปลี่ยนไปแล้ว"
                });
            }

            /*
                คืนสถานะคำขอเดินทาง
                ให้คนขับคนอื่นกดรับได้อีก
            */

            await supabase
                .from("ride_requests")
                .update({
                    status: "sent_to_driver"
                })
                .eq("group_id", groupId);

            return res.json({
                message:
                    "ยกเลิกงานแล้ว งานกลับเข้าคิวให้คนขับคนอื่นรับได้",
                group: updatedGroup
            });

        } catch (error) {
            return res.status(500).json({
                error: error.message
            });
        }
    }
);


/* =========================================================
   CANCEL RIDE
========================================================= */

app.post(
    "/api/rides/:rideId/cancel",
    requireAuth,
    async (req, res) => {

        try {

            const rideId =
                req.params.rideId;


            const {
                data: ride,
                error
            } = await supabase
                .from("ride_requests")
                .select("*")
                .eq(
                    "id",
                    rideId
                )
                .single();


            if (error || !ride) {
                return res.status(404).json({
                    error:
                        "ไม่พบคำขอเดินทาง"
                });
            }


            if (
                ride.passenger_id !==
                req.user.id
            ) {
                return res.status(403).json({
                    error:
                        "คุณไม่มีสิทธิ์ยกเลิกคำขอนี้"
                });
            }


            if (
                [
                    "completed",
                    "cancelled"
                ].includes(ride.status)
            ) {
                return res.status(400).json({
                    error:
                        "คำขอนี้ปิดไปแล้ว"
                });
            }


            /*
                ถ้าคนขับรับงานแล้ว
                ผู้โดยสารยกเลิกไม่ได้
            */

            if (ride.group_id) {

                const {
                    data: group
                } = await supabase
                    .from("ride_groups")
                    .select("status")
                    .eq("id", ride.group_id)
                    .maybeSingle();

                if (
                    group &&
                    [
                        "accepted",
                        "completed"
                    ].includes(group.status)
                ) {
                    return res.status(400).json({
                        error:
                            "คนขับรับงานแล้ว ไม่สามารถยกเลิกได้"
                    });
                }

            }


            const {
                error: updateError
            } = await supabase
                .from("ride_requests")
                .update({
                    status: "cancelled"
                })
                .eq(
                    "id",
                    rideId
                );


            if (updateError) {
                return res.status(500).json({
                    error:
                        updateError.message
                });
            }


            /*
                เอาออกจาก group
            */

            if (ride.group_id) {

                await supabase
                    .from("ride_group_members")
                    .delete()
                    .eq(
                        "ride_request_id",
                        rideId
                    );


                /*
                    เช็คว่ายังเหลือสมาชิกไหม
                */

                const {
                    data: remaining
                } = await supabase
                    .from(
                        "ride_group_members"
                    )
                    .select("id")
                    .eq(
                        "group_id",
                        ride.group_id
                    );


                if (
                    !remaining ||
                    remaining.length === 0
                ) {

                    await supabase
                        .from("ride_groups")
                        .update({
                            status:
                                "cancelled"
                        })
                        .eq(
                            "id",
                            ride.group_id
                        );
                }
            }


            return res.json({
                message:
                    "ยกเลิกการเดินทางเรียบร้อย"
            });

        } catch (error) {
            return res.status(500).json({
                error: error.message
            });
        }
    }
);


/* =========================================================
   FALLBACK
========================================================= */

app.get("*", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "..",
            "public",
            "index.html"
        )
    );
});


/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
    (
        err,
        req,
        res,
        next
    ) => {

        console.error(
            "SERVER ERROR:",
            err
        );

        res.status(500).json({
            error:
                err.message ||
                "เกิดข้อผิดพลาดใน Server"
        });
    }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "===================================="
        );
        console.log(
            "🚗 UP-Drive Server"
        );
        console.log(
            "===================================="
        );
        console.log(
            `🌐 http://localhost:${PORT}`
        );
        console.log(
            "🟢 Server started successfully"
        );
        console.log(
            "===================================="
        );
        console.log("");
    }
);