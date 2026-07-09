// ================================================
// Applebee's Loyalty Control Center
// auth.js
// ================================================

const ROLES_PERMITIDOS = [
    "admin",
    "director",
    "sistemas",
    "gerente",
    "manager"
];

let usuarioActual = null;

//--------------------------------------------------
// Esperar autenticación
//--------------------------------------------------

function esperarLogin(){

    return new Promise(resolve=>{

        auth.onAuthStateChanged(async(user)=>{

            if(!user){

                window.location.href="login-admin.html";
                return;

            }

            try{

                const snap = await rtdb.ref("users/"+user.uid).once("value");

                const datos = snap.val();

                if(!datos){

                    alert("Usuario no encontrado.");

                    auth.signOut();

                    return;
                }

                const rol=(datos.role||"").toLowerCase();

                if(!ROLES_PERMITIDOS.includes(rol)){

                    alert("No tienes permisos para acceder.");

                    auth.signOut();

                    return;

                }

                usuarioActual={

                    uid:user.uid,
                    email:user.email,
                    nombre:datos.nombre||"",
                    telefono:datos.telefono||"",
                    role:rol,
                    avatar:datos.avatar||""

                };

                resolve(usuarioActual);

            }
            catch(error){

                console.error(error);

                alert("Error validando permisos.");

            }

        });

    });

}

//--------------------------------------------------
// Obtener usuario
//--------------------------------------------------

function getUsuarioActual(){

    return usuarioActual;

}

//--------------------------------------------------
// Verificar Rol
//--------------------------------------------------

function tieneRol(...roles){

    if(!usuarioActual) return false;

    return roles.includes(usuarioActual.role);

}

//--------------------------------------------------
// Cerrar sesión
//--------------------------------------------------

async function cerrarSesion(){

    if(!confirm("¿Cerrar sesión?")) return;

    await auth.signOut();

    location.href="login-admin.html";

}

//--------------------------------------------------
// Pintar nombre del usuario
//--------------------------------------------------

function pintarUsuario(){

    if(!usuarioActual) return;

    const nombre=document.getElementById("nombreUsuario");

    if(nombre){

        nombre.innerHTML=usuarioActual.nombre;

    }

    const rol=document.getElementById("rolUsuario");

    if(rol){

        rol.innerHTML=usuarioActual.role.toUpperCase();

    }

}