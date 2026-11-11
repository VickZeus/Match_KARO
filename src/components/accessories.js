import style from "@/styles/animations.module.css"


export function Loading(){
    return(
        <div className="flex flex-col fixed inset-0 justify-center items-center z-50 bg-black/80">
        <div className={style.loadGrid}>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
        </div>
        </div>

    )
}